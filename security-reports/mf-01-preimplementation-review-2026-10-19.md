# MF-01 — Pre-Implementation Architecture Review

**Date:** 2026-10-19  
**Repository:** `/data/data/com.termux/files/home/mediaforge-git`  
**Branch / HEAD:** `main` / `c51b87a`  
**Review mode:** Read-only; no source, settings, services, or existing reports changed.  
**Release decision:** **BLOCK RELEASE**; MF-01 remains open.

## Review summary

The isolated-worker plan is directionally sound, but it is not implementation-ready. Its main omissions are still-active Render execution paths, separation of supervisor and media network identities, authoritative job-state migration, provider-specific control-plane exceptions, and upload capability lifetime/size limits. Squid is a candidate only: official ACL documentation does not prove that the address checked is the address actually connected to.

Current working tree was preserved: branch `main`, HEAD `c51b87a`; existing modified source files and the existing untracked `security-reports/` tree remain present. The requested review report did not exist before this task. No tests, production requests, or staging network tests were run.

## 1. Production execution-path inventory

The current source confirms these paths must be migrated, disabled, or intentionally retained as non-media control-plane work:

| Path | Current source evidence | Required treatment |
|---|---|---|
| Startup dependency validation | `server.ts:98-100` calls `ytDlpService.validateServerEnvironment()`. `server/ytDlpService.ts:441-471` executes yt-dlp/FFmpeg/FFprobe version checks. | Replace Render-side binary checks with worker health/capability status. Do not install or detect media binaries in the Render image at runtime. |
| Main job processing | `server/queue.ts:90-99,138-156` creates in `db.jobs`, immediately calls `processJob`, then runs `generateMediaFile` and validation. `server/ffmpeg.ts:550` calls `ytDlpService.executeDownload`; yt-dlp retries/fallbacks and FFmpeg/FFprobe run beneath it. | Remove all media execution from the Render queue. Durable dispatch to worker only. |
| Metadata/analyze endpoint | `server.ts:820` invokes `ytDlpService.getMetadata` for URL metadata. `server/ytDlpService.ts:933` executes yt-dlp; failure can invoke RapidAPI fallback at `1065-1084`. | Preserve the existing API response contract via a bounded worker metadata RPC/task, or use existing safe provider API metadata paths in Render. Any yt-dlp attempt and its retries must execute in the media sandbox. |
| Social API fallback | `/api/social-download` is registered in `server.ts:491-498`; `server/socialDownload.ts:276` falls back to yt-dlp and `:345-347` calls `getMetadata`. | Keep fixed-host RapidAPI requests in Render only if their transport remains guarded. Route yt-dlp fallback/extraction and any direct media fetch through the worker. Avoid giving media children the RapidAPI key. |
| Preview pre-warm | `server.ts:412-420` calls `generateMediaFile` asynchronously for direct-stream metadata. | Remove in-process pre-warm; submit a worker task or remove this optimization. It must not create a side channel around normal job authorization/quotas. |
| On-demand preview | `server.ts:1259-1342` calls `generateMediaFile` when a preview file is absent; `:1354` runs validation/FFprobe before stream. Preview IDs can be derived from request parameters. | Never generate media inside the Render route. Preserve preview behavior through an authorized worker artifact/task, or return the existing unavailable response. Recheck whether preview caching is user-scoped and whether a request can trigger duplicate work. |
| Preview diagnostic endpoint | `server.ts:2054-2065` registers `/api/diagnostics/preview-test`, calls `generateMediaFile` using a fixed public sample URL, then runs FFprobe and storage operations. | Make staging-only or remove from production routing. Verify its actual middleware exposure; do not assume the diagnostic name makes it private. |
| yt-dlp fallback stream path | `server/ytDlpService.ts:1396-1489` calls RapidAPI, then `fetchAndValidateMediaStream(targetMedia.url)`, FFprobe and FFmpeg. | The whole media data path, including resolved CDN URL fetch, must run in the sandbox through the gateway. Keep provider API fallback in Render only if separated so it cannot download the media there. |
| Stored artifact verification | `server/queue.ts:209` invokes `verifyDownloadArtifact`; `server/verifier.ts:184` calls FFprobe. | Move complex media parsing/FFprobe into the isolated worker. Render may verify job/lease, storage key, size/checksum and simple declared metadata, but must not parse untrusted media in its public control-plane process. |
| Additional `generateMediaFile` call | `server.ts:1329` preview path and `:2065` diagnostic, in addition to pre-warm and queue path. | Inventory all call sites at implementation time and enforce a static/code-level invariant that production Render cannot call the generator. |
| Binary bootstrap | `server/ffmpeg.ts:28-77` defines `ensureYtDlpBinary`, which downloads via guarded Node HTTP; `server.ts` imports it but current `rg` found no call site. `server/ytDlpService.ts:388-398` has a curl installer method. | Confirm unused methods stay unreachable/remove from production build. Bake pinned binaries into the worker image; do not download latest executables at runtime. |

The yt-dlp service has two format attempts (`server/ytDlpService.ts:1206-1222`) and a RapidAPI stream fallback (`:1396+`); metadata failure may make a separate provider fallback. Include all retries and provider fallback branches in worker routing and tests. Node provider calls such as oEmbed/RapidAPI can remain in Render only when the endpoint is fixed, credentials are server-side, and the guarded HTTP transport is used.

## 2. Critical design gaps and required plan corrections

### A. Split supervisor and media network identities

The plan says supervisor traffic and media traffic both use a gateway, but does not define separate source identities or gateway policies. This makes control-plane/storage paths reachable from the user-controlled media process if they share a permissive proxy listener.

Required design:

- Render is contacted only by the **supervisor**, using a fixed configured Render origin, fixed paths, and worker authentication. The media sandbox gets no Render credentials, API host configuration, or control endpoint access.
- Supabase is contacted only by the **supervisor** for artifact upload, using a fixed configured storage origin and server-derived bucket/object path. The signed capability is not passed to yt-dlp/FFmpeg. Prefer streamed/resumable upload; do not let job input choose host, scheme, port, bucket, object prefix, or upload URL.
- Only the **media sandbox** receives the normalized user source URL, and only yt-dlp or a deliberately modeled media-fetch process may fetch it. The supervisor must treat it as opaque data and never call `fetch`, resolve DNS, follow redirects, or construct an outbound URL from it.
- Give the supervisor and sandbox different network namespaces/identities and separate proxy listeners or ACL identities. Media policy denies the Render application origin, Supabase storage/auth endpoints, worker management hosts, and gateway administration addresses, in addition to non-public ranges. Supervisor policy allows only the fixed Render API and fixed storage host(s). No `NO_PROXY`, direct DNS or route bypass is available to the sandbox.
- At the worker VM edge, permit new egress only to the gateway listener IP/port. Deny all IPv4 and IPv6 direct traffic. Disable IPv6 in the media namespace if it is unnecessary; otherwise enforce equivalent rules and prove them. Block sandbox DNS, UDP/QUIC, arbitrary TCP, ICMP tunnels and other protocols. The gateway alone resolves media hostnames. Do not grant a broad UDP/53 exception to the worker.

### B. Hetzner firewall exceptions need a concrete containment proof

Hetzner documents allow-only outbound rules after custom egress rules are set, but also says metadata requests are answered locally and bypass the Cloud Firewall; provider DNS/rescue traffic is always allowed; NDP and some local traffic are not filtered; and its firewall does not protect private Cloud Network traffic. Host nftables and network namespaces are required. If metadata access cannot be disabled or contained by host policy, the worker must have no secrets/credentials available through metadata, and the exception must be tested safely. Cloud firewall configuration alone cannot satisfy the criterion.

For both worker and gateway, document interfaces, routes, IPv4/IPv6 defaults, metadata/link-local paths, DNS resolver path, and any private-network interface. A worker egress allowlist should target only the gateway’s fixed address and proxy port. Show that a child process cannot use a provider resolver or metadata path outside the intended policy. Apply host rules before starting the supervisor or workload and verify they survive reboot/redeploy.

### C. Proxy selection is unresolved; Squid is not proven

Squid’s official ACL docs establish that `dst` IP ACLs exist, not that mixed DNS answers are rejected, that resolution is pinned to the actual upstream socket, or that rebinding cannot race ACL evaluation. Do not implement the current plan with an unverified Squid configuration and call it safe.

Acceptance harness must use DNS and web servers owned by the operator and record both the gateway’s resolver answers and the numeric peer address actually connected. It must prove:

1. A-only, AAAA-only and mixed A/AAAA responses are evaluated; any mixed prohibited answer fails closed.
2. DNS answer changes between initial query, repeated query and connection attempt cannot cause use of an unchecked address; verify validated address equals socket peer.
3. Every HTTP redirect produces a fresh destination check; every HTTPS redirect creates a new CONNECT request. The gateway never trusts a hostname checked on an earlier hop.
4. Canonical and alternate IPv4 forms (integer, short, octal/hex where accepted by clients), IPv6 literals, IPv4-mapped IPv6, transition/tunnel ranges and URL parser normalization cannot evade policy.
5. Loopback, RFC1918, link-local, shared/reserved, unspecified, multicast, documentation/benchmark, metadata/provider ranges, gateway/control-plane/storage hosts, and prohibited ports are rejected. The controlled sink logs zero accepted connections for denied cases.
6. Only required HTTP(S) proxy methods and approved ports work; SOCKS, FTP, raw TCP, UDP/443/QUIC, direct DNS and unknown protocols fail. Do not add port exceptions without a provider-specific test and review.

If the selected proxy cannot expose/test the checked IP and pin that exact address to the socket, use a gateway implementation with a single resolver-to-dial path: canonicalize URL, resolve A+AAAA through a controlled resolver, reject the entire set if any answer is denied, select a permitted numeric IP, connect directly to that numeric IP without a second DNS lookup, retain the original host for TLS SNI/certificate validation, and apply the same policy for every CONNECT and redirect. Add host nftables deny rules on the gateway as a second barrier. If this cannot be demonstrated, MF-01 remains blocked; do not substitute URL validation or `--proxy` flags.

### D. Durable job state must replace the existing authority, not sit beside it

The plan proposes a `worker_jobs` table but does not fully resolve that `db.jobs` (`Map`) currently drives status, ownership, cancellation, admin views and immediate processing. `postgresManager.saveJob` persists snapshots asynchronously and `getJobs()` loads at most the latest 100; this is not a shared, authoritative queue or status store.

Required correction:

- Make persistent Postgres job state authoritative for create, status, cancel, expiry, ownership, download readiness, worker lease and admin queries. All Render instances must observe the same state; eliminate process-local-map fallback for authorization decisions.
- Create job and dispatch/outbox row in one transaction. Persistence failure returns an error and never starts work.
- Claim via one transaction that locks one eligible row (`FOR UPDATE SKIP LOCKED` or equivalent) and atomically assigns worker, random lease, attempt and lease expiry. A heartbeat extends only the current non-cancelled lease.
- Completion is compare-and-set on job ID, worker ID, lease hash, unexpired lease and non-cancelled state. Stale workers cannot renew, upload to a reusable object key, or mark ready after a newer lease exists.
- Cancellation atomically sets `cancel_requested`/terminal state. Worker polling and supervisor terminate process groups. Completion racing cancellation must lose by state predicate; if an upload already finished, record an orphan for exact-key cleanup.
- Use attempt-specific immutable storage keys or a lease-bound one-time upload authorization with overwrite disabled. A reconciler handles orphan uploads, expired leases, missing files and DB/object mismatch. Cleanup is exact-key and idempotent; no broad prefix deletes.
- Idempotency keys prevent duplicate external job creation; duplicate claim/complete/retry requests return the already-committed state, not duplicate work. Retry count/backoff and terminal `FAILED`/`CANCELLED`/`EXPIRED` behavior are explicit.
- Redis remains cache/rate-limit only. Redis outage never creates a claim, permits completion or changes ownership. Neon/Postgres outage prevents new dispatch and safe status mutations; no in-memory authorization fallback.

PostgreSQL documents `SKIP LOCKED` for queue-like consumers but notes it yields an inconsistent view by design ([PostgreSQL locking clause](https://www.postgresql.org/docs/current/sql-select.html)); the job state machine and transaction predicates still need tests.

### E. Upload capability lifetime, large-file protocol and orphan handling

The plan calls the Supabase signed upload capability “short-lived” without accounting for the current API’s documented lifetime. Supabase says `createSignedUploadUrl` tokens are valid for **2 hours** ([API reference](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl)). Its resumable TUS upload URL can remain valid up to **24 hours**, while resumable uploads are recommended above 6 MB ([resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)). A 512 MB application output cap makes ordinary one-shot upload a poor reliability assumption. Supabase upload limits are also tier/global/bucket settings; Free is currently capped at 50 MB, and a bucket limit cannot exceed the global limit ([file limits](https://supabase.com/docs/guides/storage/uploads/file-limits)).

Correct the design to choose one explicit path:

- **Preferred security boundary:** worker supervisor streams the artifact to a bounded authenticated Render endpoint; Render streams it to Supabase using the server-only key. Do not buffer the whole file in memory. This increases Render bandwidth/compute and must be costed and load-bounded.
- **If direct storage upload is necessary:** implement TUS with a per-attempt path, no upsert, server-derived host/path, token available only to supervisor, no capability in sandbox, and a cleanup process for abandoned sessions/objects. Document actual 2-hour token and up-to-24-hour resumable URL exposure; do not describe it as seconds/minutes. Verify Storage plan, global/bucket size limits, private bucket, overwrite denial and incomplete-upload cleanup in staging.

In either case Render verifies lease/state, object key, size, SHA-256 and expected media type/container before `READY`. A worker claim of validation is not sufficient. Never include signed storage URLs/tokens in logs or browser responses other than the existing download URL flow.

### F. Ownership, secrets, and child-process isolation need sharper boundaries

- Worker claim is only an instruction from Render after owner-authorized job creation; user IDs or anonymous capability hashes from clients are never accepted from the worker. Worker can report only against its lease.
- HMAC request signatures need a timestamp, nonce, canonical path/method/body digest, key ID, constant-time verification, bounded clock skew and replay-store uniqueness. If nonce/replay storage is unavailable, reject worker mutations. Support overlapping key IDs for planned rotation; never put key material in child env/argv.
- Supervisor environment must be constructed from an allowlist, not inherited. yt-dlp/FFmpeg run as a different unprivileged identity without Render HMAC keys, Supabase tokens, DB URLs, Redis credentials, logs mounts, Docker socket, host filesystem or other jobs’ directories.
- Existing yt-dlp admin cookie support (`server/ffmpeg.ts` cookie loading; `server/ytDlpService.ts` cookie args) is a functionality/security decision not addressed in the plan. Determine whether production requires it. Do not copy a broad cookie jar into the sandbox; if required, define domain-scoped secret injection, read-only per-job lifetime, no log exposure and exfiltration tests. Otherwise document that cookie-authenticated provider behavior is removed.
- Independently cap input URL length, request body, job duration, retries, concurrency, process count, CPU/RAM/disk, temp bytes, output bytes, stdout/stderr, upload bytes and polling. Cleanup must be scoped to a validated per-job/per-attempt directory, including shutdown/reboot; symlink and unrelated-file tests are required.

## 3. API/frontend compatibility and rollback

Keep existing public routes and response envelopes for analyze/social download, job creation, `GET /api/jobs/:id`, cancel, preview (where supported), signed download and stream. The current analyze and social fallback paths can be synchronous; moving yt-dlp metadata to a worker must either use a bounded authenticated worker RPC that returns the same normalized metadata shape or be introduced with coordinated frontend/API contract changes and explicit compatibility review. Do not block an Express request indefinitely on a worker or silently change a synchronous response into a job ID.

All status/download/cancel paths must read the durable authoritative job state. Keep owner and anonymous capability rules at Render. Public progress values can map internal lease/upload states to existing frontend states. Add contract tests from frontend-facing API shapes, plus cross-user status/cancel/download tests.

Rollback means stop new claims, mark/retain pending jobs safely, let in-flight leases terminate or expire, reconcile uploads and leave media processing disabled. Revert only control-plane changes that preserve the worker-only boundary. **Never restore in-process `generateMediaFile`, yt-dlp, FFmpeg or direct-stream fallback on Render.** If the worker/gateway fails, processing remains unavailable until the enforced path is restored.

## 4. Provider, price, bandwidth and storage assumptions

- **Render:** official docs describe outbound IPs as source addresses, private networking as same-region service connectivity, and inbound IP rules as ingress controls. They do not establish outbound destination filtering or mandatory proxy use by child processes. Render background workers can initiate outbound traffic and commonly poll queues ([Render background workers](https://render.com/docs/background-workers)); they do not solve MF-01 by themselves. Current Render prices/plan names change; use the current [pricing](https://render.com/pricing) and dashboard quote for compute, workspace subscription and outbound bandwidth. Do not assume static outbound IP equals filtering.
- **Hetzner:** [firewall docs](https://docs.hetzner.com/cloud/firewalls/faq/) support allow-only outbound after custom egress rules but document metadata, DNS/rescue and private-network limitations. The prior report’s CX23 floor ($6.49 US / €5.49 EU each, excluding IPv4) is from the official June 2026 table ([price adjustment](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)), not a guaranteed current checkout quote. The current [CX23 product page](https://www.hetzner.com/cloud/cost-optimized/) showed CX23 unavailable when checked; its “at least 20 TB” traffic statement is for EU locations, not a global allowance. Recheck capacity, IPv4 charges, bandwidth direction/overage, backup and volume costs before recommending the two-VM total. Gateway public IPv4, taxes, redundancy and operations are extra.
- **Supabase:** plan, project global upload limit, bucket-specific limit, private status, transfer/egress and storage price are unknown. Current docs distinguish file limits by plan and recommend TUS for large uploads. The existing code’s bucket-creation default is 25 MB (`server/supabase.ts`), while the processing cap is 512 MB; actual production bucket settings are unverified. Do not assert 512 MB uploads will work until staging uses the same tier and bucket settings.
- **AWS alternative:** use the current AWS pricing calculator for NAT, Network Firewall endpoints/data processing, transfer and logs. The earlier report’s ~$620.55/month is one example topology, not a minimum or quote. AWS security groups are allow-rule controls ([official rules](https://docs.aws.amazon.com/vpc/latest/userguide/security-group-rules.html)); they are not by themselves an arbitrary public-destination filter.
- No current production account dashboard, billing plan, service configuration, live quote, bucket policy or network was inspected. Cost comparison remains a hypothesis, not evidence that the selected design is currently available or affordable.

## 5. Exact first implementation milestone

**Milestone 1: non-production network proof-of-enforcement, before changing application dispatch.**

Provision only an owner-approved staging worker and gateway. No production secrets, user media, source changes, or production endpoints. Produce a versioned evidence bundle that proves:

1. Provider firewall and host/namespace rules permit new worker/sandbox egress only to the gateway’s fixed listener, for both address families; direct requests to operator-owned public sink endpoints fail and the sink records no arrival.
2. Worker has no direct DNS, UDP/QUIC, arbitrary TCP, IPv6 or metadata route that bypasses the policy. Provider exceptions are enumerated; metadata credentials are absent, and approved non-secret tests establish containment.
3. Gateway can show the complete DNS A/AAAA set and actual connected numeric peer. Owned controlled fixtures prove mixed-answer rejection, DNS-change/rebinding safety, redirect revalidation, IPv4/IPv6 and alternate numeric normalization, blocked ranges, ports and protocols.
4. Legitimate controlled public HTTP(S) fixture succeeds through the gateway; denied owned sinks see zero accepted connection attempts.
5. Supervisor and media sandbox identities have separate network policy; a test media child cannot reach Render control endpoints, Supabase, gateway administration or supervisor credentials.

If any item cannot be demonstrated with the candidate provider/proxy, stop before application changes and revise the provider/gateway design. This milestone does not close MF-01 or authorize production changes.

## 6. Staging prerequisites

1. Owner-approved provider/account/region, purchase quote, monthly cap, data residency, acceptable-use review, retention and availability requirements.
2. Isolated staging worker/gateway resources and firewall visibility; exact provider metadata/DNS/private-network exception docs; permission to run controlled tests only against operator-owned fixtures.
3. Controlled DNS zone and sink servers for A, AAAA, mixed answers, timed answer changes and redirects; logging confirms attempted/accepted connection and observed peer.
4. Selected gateway implementation/version with audit evidence for resolver-to-socket pinning, ports and protocols. Squid remains unselected until proven.
5. A Render staging environment with synthetic accounts and no production credentials; fixed worker API path and service identity; approved key generation/rotation approach.
6. Neon staging schema/migration/recovery test; Redis non-authoritative; Supabase staging bucket and confirmed plan/global/bucket size limit; selected upload protocol and orphan cleanup.
7. Existing API contract fixtures and authorized provider/media fixtures, including the currently supported format, trim/audio/video, preview and social fallback paths.

## 7. Testable acceptance criteria

MF-01 remains open until every check below passes on the production-equivalent revision and exact infrastructure policy:

1. **Call graph:** automated source audit or explicit reviewed inventory shows no Render runtime call to yt-dlp for metadata/download/fallback, no Render `generateMediaFile`, no Render FFmpeg/FFprobe on uploaded media, no runtime binary installer, and no user-triggered preview/diagnostic generation in the API process. Worker logs account for every legitimate media request path.
2. **Network isolation:** from the actual media namespace, IPv4 and IPv6 direct TCP, UDP, DNS, QUIC and alternate proxy/no-proxy attempts to owned external sinks are blocked at network layer; no packets arrive at sinks. Metadata/provider exceptions are enumerated and contain no usable credentials. Worker-to-gateway is the only media egress.
3. **Gateway resolution:** reject mixed safe/unsafe A/AAAA; DNS change/rebinding cannot alter the connected peer after validation; resolver result equals actual socket peer; every HTTP redirect and new HTTPS CONNECT rechecks; mapped/transition/alternate numeric encodings do not bypass; prohibited ranges/ports/protocols are denied and controlled sinks confirm no connection. If proxy cannot prove pinning, acceptance fails.
4. **Supervisor separation:** only supervisor reaches fixed Render API and fixed storage host(s); media child cannot reach either, cannot query direct DNS, and cannot read worker HMAC keys, lease/upload token, database/cache credentials or cookies. User URL fields cannot alter supervisor destination or upload object path.
5. **Queue/state:** concurrent claims return one lease; stale/wrong worker/replayed nonce cannot heartbeat or complete; cancellation wins a race; lease expiry permits at most one new attempt; persistence failure never dispatches; duplicate completion is idempotent; orphan upload reconciler cleans only exact attempt keys; all Render instances return consistent owner-scoped status.
6. **Artifact:** staging tests verify private bucket, actual size limits, no overwrite, bounded TUS/stream upload, path binding, output type/signature, size and checksum. Expired/replayed/wrong-job capabilities fail. Supabase’s documented 2-hour signed token and up-to-24-hour TUS URL are reflected in threat model and cleanup. No worker credential or signed URL is logged.
7. **Resources and cleanup:** CPU/RAM/PID/disk/concurrency/runtime/body/output/stdout/stderr/retry caps are enforced. Success/failure/timeout/cancel/restart/shutdown cleanup tests cannot remove unrelated or another job’s files. Gateway/Redis/Postgres/storage outages fail closed without Render media fallback.
8. **Compatibility:** existing public API envelopes, frontend polling/cancel/download behavior, owner/capability rules and required legitimate media flows pass against staging; synchronous metadata endpoints retain their response shape and bounded latency or have an explicitly approved contract migration.
9. **Operator evidence:** exact config revisions, firewall exports, route tables, sanitized packet/proxy logs, gateway peer-IP traces, staging bucket settings, cost quote and test results are reviewed by the owner. No production control is inferred from documentation alone.

## Remaining risks

- Provider firewall exceptions may bypass expected host rules; if metadata is reachable despite controls, keep credentials out of the worker and do not claim full containment.
- HTTPS CONNECT hides redirect content from the gateway. Safety depends on yt-dlp opening each redirect destination through the proxy and on network-level direct egress denial.
- A gateway/proxy bug or policy update can reintroduce SSRF; pin versions, review policy updates, test before rollout and fail closed.
- Extractor domains and CDN hosts change, potentially breaking legitimate downloads; allowlist-based service hosts may be brittle, while broad public access relies more heavily on correct IP filtering.
- Single worker/gateway is a pause-on-failure design. Availability, redundancy, backups and operational response remain unpriced.
- Cookies/provider credentials, Supabase limits, object cleanup, provider terms, bandwidth charges and production bucket policy remain unverified.

## Official references

- [Render outbound IP addresses](https://render.com/docs/outbound-ip-addresses), [dedicated IPs](https://render.com/docs/dedicated-ips), [private network](https://render.com/docs/private-network), [private services](https://render.com/docs/private-services), [background workers](https://render.com/docs/background-workers), [inbound IP rules](https://render.com/docs/inbound-ip-rules)
- [Hetzner Cloud Firewall FAQ](https://docs.hetzner.com/cloud/firewalls/faq/), [firewall rule setup](https://docs.hetzner.com/cloud/firewalls/getting-started/creating-a-firewall/), [price adjustment June 2026](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/), [CX23 product/traffic](https://www.hetzner.com/cloud/cost-optimized/)
- [Squid ACL directive](https://www.squid-cache.org/Doc/config/acl/)
- [PostgreSQL `SELECT` locking clause](https://www.postgresql.org/docs/current/sql-select.html)
- Supabase [`createSignedUploadUrl`](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl), [resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads), [file size limits](https://supabase.com/docs/guides/storage/uploads/file-limits)
- [AWS Security Group rules](https://docs.aws.amazon.com/vpc/latest/userguide/security-group-rules.html)

**Conclusion:** Correct the plan as described, start with the isolated staging network proof, and keep **BLOCK RELEASE** until all acceptance criteria pass. MF-01 is not closed by this review.
