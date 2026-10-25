# MF-01 — Isolated Media Worker Implementation Plan

**Date:** 2026-10-19  
**Repository:** `/data/data/com.termux/files/home/mediaforge-git`  
**Branch / HEAD:** `main` / `c51b87a`  
**Decision:** **BLOCK RELEASE**  
**Scope:** Design and implementation plan only. No source, configuration, infrastructure, or external service changes were made.

## Executive recommendation

Keep Render as the public API and authorization control plane. Move every production yt-dlp and FFmpeg invocation into a separate Linux worker environment whose cloud firewall and host network rules permit only a dedicated egress gateway. Run a destination-filtering forward proxy on the separate gateway. The worker must not have a direct route to the Internet, and neither yt-dlp proxy arguments nor Render static outbound IPs count as enforcement.

A low-cost self-managed two-VM deployment is the simplest affordable candidate found, subject to provider/region availability and controlled proof. Hetzner Cloud documents outbound firewall rules and no firewall charge, but also documents metadata and provider-service traffic that bypasses those rules. It therefore requires host-level controls and explicit tests, and is not a ready-made guarantee. The gateway proxy must independently validate the actual destination IP used for each connection. Squid is a plausible candidate, but its documentation alone does not prove all mixed-answer, rebinding, alternate-address, and connection-time cases; those remain mandatory version-specific acceptance tests.

## Repository and report review

Current state was checked read-only before creating this report:

- Root: `/data/data/com.termux/files/home/mediaforge-git`
- Branch / HEAD: `main` / `c51b87a`
- Existing modified and untracked work was present and preserved. The existing reports and ignored build outputs were not changed.
- The requested deliverable did not exist before this task.

Read the four named reports: the Phase 1 audit, Phase 2 remediation, `mf-01-production-egress-verification-2026-10-19.md`, and `mf-01-infrastructure-options-2026-10-19.md`, plus `SSRF_EGRESS_LIMITATIONS.md`. Current code review focused on `server.ts`, `server/queue.ts`, `server/ytDlpService.ts`, `server/ffmpeg.ts`, `server/jobAccessRoutes.ts`, `server/jobAuthorization.ts`, `server/postgres.ts`, `server/redis.ts`, `server/db.ts`, `server/supabase.ts`, and `Dockerfile`. No secrets or credential-bearing environment files were read.

## Verified current lifecycle and trust boundaries

```text
Browser
  │ existing public API: authenticate / validate / authorize
  ▼
Render Express ── in-memory db.jobs Map + async Postgres snapshot + Redis cache
  │ currently starts processing in the API process
  ├── yt-dlp → temporary per-job directory → FFmpeg/FFprobe
  ├── Supabase private storage upload → artifact verification → signed download URL
  └── existing job status / cancel / owner-or-anonymous-capability download routes
```

Verified implementation details relevant to the design:

- `server/queue.ts` creates the job in the process-local `db.jobs` map, asynchronously persists a snapshot through `postgresManager.saveJob`, caches it through `redisManager.cacheJob`, then calls `processJob` immediately. It is not a durable multi-worker queue.
- `server/queue.ts` executes `generateMediaFile`, reads the completed file into memory, uploads with the server-side Supabase client, verifies the stored artifact, and marks the job ready. `server/jobAccessRoutes.ts` and `server/jobAuthorization.ts` enforce existing status, cancellation, and download ownership/capability checks.
- `server/postgres.ts` persists `media_jobs` snapshots and reads the latest 100 rows; no atomic claim/lease protocol was found. `server/redis.ts` includes cache and rate-limit behavior; the reviewed `cacheJob` path is not a work queue.
- `server/ytDlpService.ts` invokes yt-dlp as a child process. Its proxy argument and cleared `NO_PROXY` variables are application-side measures only. yt-dlp has independent DNS, redirects, extractor, CDN/fragment, and helper request behavior. `server/outboundHttp.ts` controls Node HTTP transport paths, not child-process sockets.
- `server.ts` also contains a metadata-preview pre-warm call to `generateMediaFile` outside the normal job queue, plus a separate direct generation path. Those routes must be moved behind the worker boundary or intentionally disabled before release; moving only `BackgroundJobQueue.processJob` is incomplete.
- The current pipeline uses per-job temporary paths and output validation, but filesystem state and process execution are within the Render app container. The Dockerfile is not an egress policy.
- Supabase storage is accessed by the control plane through its server-side client. Existing public download behavior includes owner/capability authorization and short-lived signed delivery. Actual production bucket policy and settings remain operator-verification items.

## Proposed architecture and flow

```text
Browser ─HTTPS─> Render API / control plane
                   ├─ authentication, ownership, request validation
                   ├─ Neon: durable job state + atomic lease/outbox
                   ├─ Redis/Upstash: cache and rate limits only
                   └─ fixed worker API <──── authenticated polling/heartbeat/result ────┐
                                                                                           │ HTTPS
Worker host: supervisor + strict job schema                                               │
  └─ per-job unprivileged sandbox/network namespace                                       │
       ├─ yt-dlp ─┐                                                                       │
       └─ FFmpeg ─┴─ proxy only ─> Egress gateway ─> approved public HTTP(S) destinations ┘
                
Worker supervisor ─short-lived scoped upload capability via gateway─> private Supabase
Render verifies object/job metadata and checksum; existing download API and UI remain in place.
```

### Responsibilities and data flow

1. **Accept and authorize:** Render keeps existing browser APIs, authentication, job creation, per-user/anonymous capability rules, job status, cancellation, and download endpoints. It validates the URL and job options before persisting. Client-supplied `userId`, callback URLs, shell commands, binary paths, environment variables, and arbitrary storage keys are never worker instructions.
2. **Persist and dispatch:** Insert the authorized job and dispatch state atomically in Neon (or use a transactional outbox). Only the control plane creates dispatchable jobs. A separate `worker_jobs` table can hold `job_id`, state, attempts, `lease_owner`, hashed lease token, lease expiry, heartbeat, and idempotency key; source input and allowed output options should be stored separately from the worker’s mutable result. Do not expose application database credentials to the worker.
3. **Claim:** Worker supervisor polls a fixed Render endpoint. Render atomically leases one eligible job, checks that it is authorized and not cancelled/expired, then returns only a strict schema: opaque job ID, lease ID/token, normalized source URL(s) and permitted options (format/quality enums, bounded trim values, maximum bytes, deadline, and storage object key derived by Render). No arbitrary command or callback URL is accepted. If legitimate existing flows require a direct media URL, it must be an explicitly modeled URL field validated by Render and still subject to the same gateway policy.
4. **Execute:** Supervisor starts yt-dlp in a fresh unprivileged sandbox with a fixed executable, fixed argument templates, read/write access only to that job’s directory, no host mounts, no service credentials, no Docker socket, and no general network namespace route. FFmpeg/FFprobe receive local file paths only. The proxy URL is fixed by deployment, not job input; `NO_PROXY` and equivalent bypass configuration are absent. These are defense-in-depth controls; network policy remains authoritative.
5. **Report and upload:** Heartbeats, progress, failure, cancellation, and completion use fixed API paths and the current lease. Render verifies worker identity, lease, job state, expiry, output size/type/checksum, and expected object key before accepting completion. The recommended simple artifact path is a short-lived, single-object signed-upload capability created by Render for a server-derived private-bucket key, with overwrite disabled; it is held only by the supervisor, never passed to yt-dlp/FFmpeg. The worker sends the object through the same enforced gateway. The control plane then verifies the uploaded object and retains the existing private download flow. If signed upload cannot be constrained sufficiently in the deployed Supabase configuration, stream the artifact to an authenticated bounded Render upload endpoint and let Render upload it with its server credential instead.
6. **Present results:** Render alone updates the authoritative user-visible job state, applies existing ownership checks, and issues the existing short-lived download authorization. Worker completion never decides ownership or returns a user-visible signed download URL.

### Proposed internal API (illustrative contract, not implemented)

All routes should be under a fixed internal namespace, rate-limited, bounded, and inaccessible to browsers. Example:

| Route | Direction | Purpose and checks |
|---|---|---|
| `POST /internal/v1/worker/claim` | worker → Render | Authenticated supervisor claims one eligible authorized job; no caller-selected user or callback. |
| `POST /internal/v1/worker/jobs/{id}/heartbeat` | worker → Render | Lease-bound progress/state heartbeat; reject stale or wrong worker leases. |
| `POST /internal/v1/worker/jobs/{id}/complete` | worker → Render | Lease-bound object key, byte count, MIME/container summary, SHA-256; Render independently verifies storage artifact before `READY`. |
| `POST /internal/v1/worker/jobs/{id}/fail` | worker → Render | Sanitized error code, retryability, attempt; no raw stderr or source credentials in API/logs. |
| `POST /internal/v1/worker/jobs/{id}/cancel-ack` | worker → Render | Supervisor confirms process-group termination and cleanup for current lease. |

Use TLS plus a dedicated worker identity. A minimal initial option is HMAC over method, canonical path, timestamp, nonce, and body digest, with a key separate from user/session/download secrets; constant-time comparison; narrow clock skew; bounded nonce replay store; and key ID for staged rotation. The control plane returns a random short-lived lease capability bound to one job and worker identity; store only a hash and invalidate it on completion, cancellation, or lease expiry. A separately provisioned mTLS identity is an alternative if certificate lifecycle can be operated safely. Never put credentials in job payloads, child environment, command arguments, stdout/stderr, or URLs. Do not accept a callback URL from either client or worker.

## Mandatory network-egress design

### Required topology and enforcement

- Place the worker and gateway in a provider/account/network where the operator controls worker outbound rules. Configure the provider firewall with default-deny outbound and allow only the gateway’s fixed private or public address and port. Apply host nftables rules as an independent deny-by-default layer for both IPv4 and IPv6; explicitly block metadata/link-local destinations and unexpected local routes. Confirm actual provider-specific exceptions.
- Put the media child process in its own network namespace/container with no direct route except the proxy endpoint. Worker supervisor traffic (Render API and storage upload) also must use the gateway; avoid host-level “management” routes inherited by the sandbox. Keep administration on a separately controlled path and exclude it from the media namespace.
- Gateway accepts proxy traffic only from the worker’s fixed identity/address. Permit only HTTP and HTTPS request methods / CONNECT to approved ports (initially 80 and 443 only if legitimate provider compatibility requires both). Deny SOCKS, arbitrary TCP/UDP, FTP, QUIC/UDP 443, DNS-over-HTTPS direct paths, and unknown protocols. Decide on port 80 from compatibility testing; do not widen silently.
- The gateway must parse/canonicalize targets, normalize IPv4/IPv6 and mapped addresses, reject alternate numeric host forms if they can be interpreted as IP literals, and apply a maintained IANA special-purpose address policy plus explicit provider metadata ranges. Resolve A and AAAA itself for each new destination; reject the entire answer set if any address is prohibited (mixed public/prohibited responses fail closed). Pin the chosen permitted numeric result into the actual upstream socket; never do a second unconstrained resolution between validation and connect. Revalidate on every new connection and every redirect. Log decision, canonical hostname, resolved address class, policy version, and result without query strings or credentials.
- HTTPS CONNECT remains end-to-end TLS (no content interception). The gateway can validate and pin the CONNECT destination IP and port, but cannot inspect encrypted redirect responses. Therefore verify that yt-dlp’s redirect and fragment requests each create a new proxy request and are rechecked. Network-layer prohibition remains the backstop if a client fails to proxy any request.
- Deny gateway egress to loopback, private, shared, link-local, unspecified, multicast, reserved, documentation, benchmark, IPv4-mapped/transition/tunnel ranges, metadata endpoints, and provider control-plane/service destinations; maintain both IPv4 and IPv6 coverage. An IP-set firewall deny is defense-in-depth, not a substitute for safe resolver-to-socket pinning. Review DNS resolver traffic separately; only the gateway should resolve media destinations, through a trusted resolver path.
- Protect the gateway itself: no proxy open to the Internet, default-deny inbound, no admin web interface on proxy listener, patched OS/proxy, resource ceilings, connection and bandwidth limits, health monitoring, alerting, and redacted access logs. Gateway unavailability fails jobs; there is no direct-egress fallback.

### What current provider documentation establishes (and does not)

**Render:** The reviewed documentation describes [outbound IP ranges](https://render.com/docs/outbound-ip-addresses) and [dedicated outbound IPs](https://render.com/docs/dedicated-ips) as source-address identification/allowlisting, [private networking](https://render.com/docs/private-network) as service-to-service connectivity, and [inbound IP rules](https://render.com/docs/inbound-ip-rules) as inbound restrictions. Render private/background services may initiate outbound requests ([private services](https://render.com/docs/private-services)). Environment traffic blocking is explicitly limited to private-network traffic ([projects and environments](https://render.com/docs/projects#blocking-cross-environment-traffic)). The reviewed sources do not document a destination egress firewall or mandatory proxy policy for service/child-process outbound traffic. Thus Render remains the API control plane, but is not the proposed worker network boundary. A Render Support statement would be useful discovery, but cannot replace deployment configuration and a controlled direct-egress denial test.

**Hetzner candidate:** Its [Cloud Firewall overview](https://docs.hetzner.com/cloud/firewalls/overview/) says rules restrict inbound and outbound traffic, unmatched outbound is permitted by default when no rules exist, and custom rules can create an allow-only policy; it publishes the firewall as free. Its [FAQ](https://docs.hetzner.com/cloud/firewalls/faq/) explicitly says metadata requests are answered locally rather than traversing the Cloud Firewall, and some provider DNS/rescue traffic is always permitted. Therefore a Hetzner allowlist can be one worker-to-gateway layer but **cannot alone establish direct-egress denial**. Add host firewall and sandbox namespace rules, ensure no private Cloud Network route bypasses intended policy, and prove actual behavior with owned fixtures and provider-level config inspection.

**Squid candidate:** Squid’s official [`acl` directive](https://www.squid-cache.org/Doc/config/acl/) documents ACL mechanisms, predefined localhost/link-local ACLs, and address conversion/lookups. This establishes that destination ACLs are configurable, not that a proposed configuration handles every DNS race, mixed A/AAAA answer, alternate address encoding, mapped address, or redirect safely. A production decision requires a pinned Squid release/config review and controlled tests showing the resolver result checked is the same IP used by the upstream connection. If this invariant cannot be shown, use a gateway implementation with documented connection-time IP pinning and an auditable policy engine instead; do not claim Squid alone resolves MF-01.

**Supabase:** The [JavaScript `createSignedUploadUrl` reference](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl) documents issuing signed upload capabilities. The project bucket’s actual privacy, upload constraints, overwrite behavior, token expiry, and deployed policy are not verified here. Confirm those against the current official Storage/API docs and a staging project before selecting this path. Never expose a service-role key to the worker.

## Queue, Neon, and Redis decision

**Prefer Neon/PostgreSQL as the durable source of truth for the first migration**, using a dedicated work/lease table and atomic claim/lease transactions (or an outbox tied to the job transaction). PostgreSQL documents `FOR UPDATE SKIP LOCKED` as useful for queue-like consumers, while warning that it provides an inconsistent view intended for that pattern ([PostgreSQL SELECT locking clause](https://www.postgresql.org/docs/current/sql-select.html)). Claim and lease updates must be one transaction; completion must be conditional on current lease, expected state, and authorized job. Workers get no direct DB access. Use a bounded connection pool and Neon-compatible pooling/timeout configuration verified in staging.

This minimizes new services and avoids treating the existing Upstash integration as a queue when current code uses it for cache/rate-limit functions. Redis can remain cache and rate-limit state, but Redis availability must not authorize a job claim or completion and must not weaken ownership. If Neon connection/pooling limits or operational latency make this unsuitable, select a managed durable queue as a separate, reviewed design; messages should contain opaque job IDs only and the Render control plane should still be the authority for ownership and lease validation.

Queue requirements: idempotency key; per-user/global pending caps; maximum attempts; lease expiry and heartbeat; reaper for expired leases; cancellation checks; worker concurrency initially one; no duplicate `READY` transition; compare-and-set completion; bounded backoff; poison-job quarantine; atomic completion/outbox state; and explicit no-worker/no-database failure behavior. Do not dispatch a job if durable persistence fails.

## Isolation and operations requirements

- Run a small supervisor separately from the media sandbox. Media process user has no login, no elevated capabilities, read-only root filesystem, only its per-job scratch mount, no host PID/network namespace, and no secrets or application mounts. Use cgroups / container limits for CPU, memory, PIDs, file descriptors, and disk; enforce a per-job maximum output size and total scratch quota.
- Start with one job per worker and a single bounded job runtime (initial value should be derived from existing product timeout and staging evidence, not expanded to avoid failures). Terminate process groups on deadline/cancel; SIGTERM grace then SIGKILL; on host restart reclaim only expired leases and clean only directories with a validated job ID and worker-owned marker. Do not recursively clean arbitrary paths.
- Preserve existing maximum file-size intent (currently yt-dlp argument caps at 512 MB) and enforce it at filesystem/quota and upload boundary; also cap request body, URL length, stdout/stderr bytes, queue depth, retry count, and worker output metadata. Avoid reading the full media file into a Node buffer as the worker handoff evolves.
- Generate isolated job IDs and object keys in Render. Per-job directories use restrictive permissions; never trust the title as a path. Verify file type by probing and signature/container checks; do not trust worker MIME claims alone. Ensure cross-job directory access and object overwrite are denied.
- Metrics: queue age/depth, lease expiry/retry, processing duration, bytes/disk use, worker/gateway health, proxy allowed/denied counts by reason, policy version, cleanup failures, and upload/verification failures. Do not label metrics with full URLs or user data. Alerts should cover gateway/downstream policy drift and disk exhaustion.
- On worker, gateway, queue, or storage failure: stop claiming, fail/retry only within policy, preserve existing owner-scoped status response, and never run local yt-dlp in Render as fallback. On shutdown, stop claims, finish or terminate active process groups, clean current job safely, release/expire lease, and exit.

## Cost and deployment comparison

| Option | Security / operational fit | Cost evidence and uncertainty |
|---|---|---|
| Render-only (including dedicated IP or Render worker) | Lowest code/infrastructure change, but documented controls do not provide destination egress filtering. Not acceptable for MF-01 without additional verified Render capability. | Render dedicated IPs cost extra and identify outbound source; exact fee is shown in the account dashboard. Worker compute costs extra. Neither price buys documented destination filtering. |
| Separate worker + gateway VMs (preferred candidate) | Direct worker allowlist to gateway plus host/sandbox deny policy; gateway destination filtering. Affordable, but self-managed patching, proxy policy, firewall evidence, monitoring, backups, and single points of failure. | Prior official Hetzner price review found CX23 at a published $6.49/month in US or €5.49/month in EU, excluding IPv4, based on its June 2026 [price table](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/). A two-CX23 compute floor is therefore about **$12.98/month** or **€10.98/month**, before IPv4, tax, volume/backup charges, extra traffic, and operations. The [product page](https://www.hetzner.com/cloud/cost-optimized/) describes CX23 as 2 vCPU, 4 GB RAM, 40 GB NVMe and variable shared-CPU capacity; product availability can vary and the page may show unavailable. The official firewall page says there is no firewall charge. Verify current checkout price, IPv4, region, traffic allowance/overage, backup price, and disk needs before approval. A public IPv4 on the gateway and controlled redundancy may materially increase the floor. |
| AWS with worker security group limited to gateway; managed inspection | More mature managed network building blocks, but greater IAM/VPC/NAT/logging complexity. AWS Security Groups provide allow rules and do not themselves provide a destination deny list ([AWS Security Group rules](https://docs.aws.amazon.com/vpc/latest/userguide/security-group-rules.html)); the gateway still needs policy. | AWS Network Firewall cost cited in the previous report was about **$620.55/month** for its example centralized inspection topology, not a minimum quote or this app’s required topology ([AWS cost example](https://docs.aws.amazon.com/solutions/latest/centralized-network-inspection-on-aws/cost.html)). Exact cost depends on endpoints, processing, NAT, transfer, logs, and region; likely overkill for a low-volume starter. |

These are published reference costs, not provider quotes. Worker processing duration and public media transfer can dominate. Budget must separately include gateway and worker IPv4, inbound/outbound bandwidth or transfer overage, disk/backup snapshots, monitoring/log retention, taxes, and redundant capacity. Start with one job at a time; benchmark authorized staging downloads before sizing. A single gateway failure pauses media jobs, which is acceptable for the security boundary but is an availability risk.

## Affected modules and proposed changes

No modules are changed in this planning phase. Likely implementation scope, subject to source re-review and separate implementation authorization:

| Area | Likely modules | Planned responsibility |
|---|---|---|
| Queue/state | `server/queue.ts`, `server/db.ts`, `server/postgres.ts`, new migration/schema module | Durable job/outbox record, atomic claims, leases, retries, cancellation and conditional completion; remove immediate local processing. |
| Control API | `server.ts`, new `server/workerRoutes.ts`, auth/rate-limit middleware | Fixed authenticated worker endpoints; authorize at dispatch; validate strict schemas and lease; redact. |
| Processing boundary | `server/ytDlpService.ts`, `server/ffmpeg.ts`, new worker supervisor/sandbox deployment files | Remove production child-process execution from Render; run yt-dlp/FFmpeg only in isolated worker. Ensure metadata preview pre-warm and every other invocation follows this boundary. |
| Storage/completion | `server/supabase.ts`, `server/queue.ts`, `server/jobAccessRoutes.ts`, artifact verification module | Scoped upload capability or bounded upload endpoint; control-plane verification and existing download contract. |
| Deployment / egress | New worker and gateway config, firewall policy, proxy config, service docs/runbook | Default-deny worker network; gateway connection-time filtering; controlled operations. No existing Render manifest/firewall config was found in reviewed deployment files. |
| Tests | `server/regressionTests.ts` and dedicated gateway/worker integration fixtures | Contract/auth/lease tests, artifact isolation, resource cleanup, network-policy controlled tests, legitimate-provider flows. |

Keep current browser API response shapes and `GET /api/jobs/:id`, cancel, download authorization, and frontend polling behavior compatible. Statuses may map internal `LEASED`/`UPLOADING` into existing public status values if compatibility requires; no public worker route.

## Staged migration and rollback

1. **Architecture and threat model:** inventory every `spawn`/`execFile` and every route that can trigger media processing, including previews, admin/test routes, direct-media/playlist paths, and error retries. Define URL/options schema, exact worker identity, privacy/retention, provider terms, region, RPO/RTO, budget, and data-flow contracts.
2. **Infrastructure and egress proof (before application code):** provision non-production worker and gateway under approved provider account; configure cloud firewall, host firewall, namespaces, proxy and logs. Prove direct worker egress denial from the actual sandbox; test proxy DNS/address/redirect/port policy using controlled owned endpoints and fixtures. Record exact versions/config hashes and packet/proxy evidence. Do not use production user data.
3. **Authenticated worker API:** implement fixed endpoints, HMAC/mTLS, replay protection, strict schemas, lease token, clock policy, redaction, request limits, and synthetic-user authorization tests. Never expose Neon credentials to the worker.
4. **Durable dispatch and reconciliation:** add durable queue/lease/outbox and make API job creation conditional on persistence. Implement claim/heartbeat/reaper/idempotency, cancellation, retries, and reconciliation between job row, lease, and storage artifact. Keep the public API contract stable.
5. **Artifact integration:** choose scoped signed upload after checking exact bucket and capability semantics, or use bounded streaming upload through Render. Verify size, content signature, checksum, private object key, no overwrite, unauthorized path denial, and cleanup of orphan artifacts. Existing signed download flow remains owned by Render.
6. **Regression and security testing:** implement the test plan below. Any uncertain DNS behavior must be resolved by code/config evidence and controlled traffic tests before proceeding. No test against cloud metadata or unrelated infrastructure.
7. **Staging verification:** end-to-end with synthetic users and legitimate test media from authorized providers; confirm all yt-dlp child requests use gateway, normal formats work, existing frontend/API behavior holds, cancellation/restart/retry works, and egress-denial logs prove no bypass. Review production-equivalent policy and secrets handling.
8. **Production rollout (separate approval required):** deploy control-plane code and worker/gateway by staged release; initially route a small controlled cohort or one job at a time. Observe metrics and error budget, compare successful legitimate providers, and keep media processing disabled if evidence deviates. This plan authorizes no production changes.

**Rollback:** stop new worker claims and keep jobs pending/failed with bounded expiry. Disable media processing if the worker/gateway is unavailable. Do not restore in-process yt-dlp or remove egress controls as a fallback. Revert public API/control-plane changes only while processing remains disabled or another proven egress boundary is active. Preserve job records and logs; expire leases safely and reconcile any uploaded artifacts before deleting them. A gateway policy rollback must revert to the last known-good restrictive policy, never a permissive default.

## Test plan and evidence

| Area | Required controlled verification |
|---|---|
| Direct egress | From the same worker sandbox/user/network namespace as yt-dlp, attempt harmless owned public test endpoints without proxy, via alternate env settings, IPv4 and IPv6, UDP/QUIC, arbitrary TCP, and DNS. Every direct path must fail at provider/host network layer; capture firewall deny evidence and confirm no packet reached the owned sink. Include metadata-route denial using provider-approved test methodology; do not query real credential endpoints. |
| Gateway destination policy | Owned test DNS/service fixtures: public-only A/AAAA succeeds; mixed public/private fails as a whole; DNS answer changes between lookup and connection; redirect from allowed owned host to prohibited owned test sink; redirect chains; loopback/private/link-local/unspecified/multicast/reserved/documentation/metadata address classes; IPv4-mapped/transition cases; decimal/octal/hex/short numeric IPv4 spellings; IPv6 canonical/mapped forms; prohibited ports and non-HTTP protocols. Capture resolver decisions, selected connection IP, proxy deny logs, and sink logs. No unrelated/internal probing. |
| yt-dlp coverage | Exercise metadata, redirects, playlist behavior, format selection, fragments/CDN, extractor helper traffic, thumbnails/previews, and each existing direct-media path. Confirm proxy logs contain every external request and worker direct deny counters remain as expected. Include test that `NO_PROXY`/case variants or hostile job fields cannot bypass. |
| Authentication/ownership | Synthetic user A creates job; worker identity claims only through control plane; user B cannot inspect/cancel/download; wrong worker, stale lease, replayed nonce, forged callback, altered body, wrong job ID, expired lease and duplicate completion all fail. |
| Queue/failure | Two worker claim races lease a job once; persistence failure prevents dispatch; Neon/Redis outage behavior is explicit; stale lease reaper, bounded retries, poison jobs, cancellation, restart, duplicate messages, and idempotent completion are verified. Redis outage cannot authorize work. |
| Artifact/cleanup | Signed upload is one-object, short-lived, no-overwrite, private and exact-path scoped; invalid MIME/container, oversize file, bad checksum, traversal path, cross-job path, expired capability and wrong lease fail. Cleanup on success, failure, timeout, cancellation, host shutdown/restart leaves no unrelated files. |
| Resource/logging | CPU/RAM/PID/disk/concurrency/runtime/stdout/stderr/HTTP request caps are enforced; proxy and worker logs omit URL query secrets, cookies, tokens, signed URLs and credentials. Gateway outage never causes direct fallback. |
| Compatibility | Existing frontend status polling, cancel and download response contract; legitimate provider download formats, trim/audio/video and supported direct paths; production-like Supabase upload and current HMAC download routes. Verify through staging only. |

Evidence package for closure should include tested worker/gateway policy versions and config hashes; sanitized provider firewall exports/screenshots; host/namespaced rules; packet/flow proof of direct denial; gateway DNS decision and connection-IP traces; controlled sink results; yt-dlp proxy coverage; artifact/auth/ownership results; cleanup/resource-limit results; and successful legitimate staging downloads. Secrets and signed URLs must be redacted.

## Risk register

| Risk | Impact | Mitigation / decision |
|---|---|---|
| Provider firewall exceptions (metadata, DNS, control-plane) bypass expected policy | SSRF can persist despite “allow gateway only” cloud rules | Host firewall, dedicated network namespace, no credentials in worker, provider-specific documentation review, and tests of actual route. Block release if exception cannot be contained. |
| Gateway resolves safely but connects to a different/re-resolved address | DNS rebinding SSRF | Resolve once per connection, reject mixed answers, pin numeric socket destination; prove with controlled rebinding fixtures. No closure from ACL text alone. |
| Squid ACL behavior differs by version/address form or HTTPS redirects are invisible | Prohibited destination may pass | Pin version, test every representation and hop; HTTPS CONNECT destination IP is checked at gateway and each new redirect tunnel must be seen. Replace candidate proxy if pinning invariant is unproven. |
| yt-dlp/provider functionality needs a disallowed host/port/protocol | Failed legitimate jobs or pressure to weaken policy | Start narrow; capture host/port classes from authorized staging and review exceptions individually. Never allow an exception to private/metadata ranges. |
| Durable queue migration duplicates/losses jobs | User-facing status inconsistency or duplicate cost | Transactional outbox, lease token, idempotency, state reconciler, bounded retry, staging restart/race tests. |
| Worker or gateway single-point failure | Media jobs pause | Explicit fail closed; health alerts and documented recovery. Add redundancy only after workload and budget evidence. |
| Upload capability/object key misuse | Cross-user overwrite or public leak | Server-derived object key, short expiry, no overwrite, private bucket verification, object validation; alternatively authenticated upload through Render. |
| Proxy logs capture sensitive URL/cookie data | Credential leakage | Custom redaction/log formats, short retention, restricted access, test with synthetic canary secrets. |
| Cost/transfer assumptions are wrong | Unexpected operating cost | Verify provider checkout/IPv4/storage/backup/traffic rates and stage bandwidth before approval. |
| Worker compromise | Read other jobs or attack internal systems | One job sandbox, no secrets or host mounts, limited supervisor API, gateway-only egress, quota/cgroup, patched immutable image, short lease. |

## Exact prerequisites before implementation/closure

1. Owner selects and approves provider, region, monthly budget, data-retention policy, availability target, and acceptable-use review. Verify live VM/IPv4/disk/backup/traffic quotes.
2. A staging account/project and test media/endpoints under the owner’s control; no production secrets or real user media.
3. Provider confirms the exact firewall semantics and enumerates unavoidable metadata/resolver/provider exceptions. Operator can inspect both cloud and host rules.
4. A gateway design/version is selected that can prove DNS resolution and the actual upstream connect use the same validated address; mixed public/prohibited answers fail closed for IPv4 and IPv6. Squid is not approved by name alone.
5. A controlled network test harness covers direct egress, DNS change/rebinding, redirect hops, IPv4/IPv6/numeric address forms, port and protocol restrictions, including permitted provider-approved metadata-path tests without accessing real secrets.
6. Worker identity/key lifecycle and replay storage are approved; separate secrets are provisioned out of band only after implementation authorization. Rotation overlaps are tested, and sandbox children cannot read control credentials.
7. Neon durable queue schema, connection limits, migration/backups/rollback, and the exact Render-to-worker network path are reviewed. Redis remains non-authoritative.
8. Supabase private bucket, signed upload behavior, upload limit, overwrite rules, signed capability expiry and path binding are verified in staging. A bounded Render upload endpoint is the fallback design if not.
9. Every yt-dlp/FFmpeg invocation path—including preview pre-warm and administrative/direct paths—is inventoried and assigned to the worker or disabled. There must be no production in-process fallback.

## Objective MF-01 acceptance criteria

MF-01 may close only when **all** criteria pass with evidence on the exact production-equivalent revision and infrastructure policy:

1. **Network layer:** from the same sandbox/network context that executes yt-dlp, direct IPv4 and IPv6 TCP/UDP/DNS/QUIC egress is denied except the explicitly permitted gateway endpoint. Provider-level and host/namespace rule evidence agrees. Attempts to use alternate proxy environment settings, direct socket code, numeric IP forms, and no-proxy settings cannot reach an owned direct-egress sink. Provider metadata exceptions are separately contained and cannot return credentials.
2. **Gateway:** on every outbound connection, DNS A and AAAA are evaluated, mixed safe/unsafe results are rejected, the validated address is the actual connected address, and all redirects/new connections are re-evaluated. Controlled tests reject prohibited IPv4/IPv6/special/reserved/metadata/mapped/transition/alternate numeric forms, unsafe ports, and disallowed protocols without the destination sink receiving a connection. Proxy/gateway is not Internet-open.
3. **All yt-dlp paths:** request traces show metadata, extractor, redirect, playlist/format/fragment/CDN, thumbnail/preview, and any supported direct-media traffic routed through the gateway. No production yt-dlp or FFmpeg network-capable invocation remains in Render. FFmpeg receives only local files.
4. **Legitimate function:** authorized staging/production-like tests confirm required providers, formats, options, storage delivery, current public API shapes, status, cancellation, and user download behavior work while the gateway is enforced.
5. **Identity and isolation:** only Render-authorized jobs are claimable; HMAC/mTLS, replay, lease expiry, wrong-worker, stale job, forged completion and duplicate completion cases fail. Ownership remains Render’s; client ownership and arbitrary callbacks are ignored. One synthetic user cannot obtain another’s job or artifact.
6. **Artifact/cleanup/limits:** object path, privacy, no-overwrite, type/size/checksum checks are verified; worker cannot read another job’s files; output limits, concurrency, process cleanup and storage cleanup pass for success/failure/timeout/cancel/shutdown/restart.
7. **Operational proof:** gateway and worker logs/metrics prove policy version and decisions without secrets; outage is fail closed; operator verifies deployed provider settings and change control. Production evidence is gathered without probing unrelated systems or real metadata credentials.

A proxy variable, `--proxy` argument, successful ordinary download, unit tests alone, static outbound IP, private networking, or cloud firewall rule alone does not satisfy closure.

## Conclusion

- **Recommended architecture:** **B — Render control plane plus separate isolated worker and destination-filtering egress gateway.** Prefer a low-cost self-managed two-VM candidate only after provider-specific firewall exceptions and gateway connection-time pinning are proven. Keep Neon authoritative with an atomic leased job table; retain Redis for cache/rate limits.
- **Exact prerequisites:** Provider/region and budget approval; staging infrastructure; inspectable default-deny cloud and host rules; a gateway whose validated DNS result is pinned to the actual socket; controlled IPv4/IPv6/redirect/protocol fixtures; durable Neon lease schema; worker identity/key rotation design; and verified private Supabase upload constraints.
- **First implementation milestone:** Build only the non-production worker/gateway network boundary and produce the acceptance evidence for direct-egress denial plus gateway destination rejection before changing application dispatch.
- **Remaining blockers:** Current Render controls do not establish outbound destination filtering; no worker/gateway is provisioned or tested; Hetzner documents metadata/provider exceptions; Squid docs do not prove the complete connection-time invariant; queue is currently in-process; preview/direct media processing paths remain in the Render code; production storage/firewall settings and live costs have not been verified.

**Final release decision: BLOCK RELEASE. MF-01 remains open.**
