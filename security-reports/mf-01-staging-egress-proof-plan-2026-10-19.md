# MF-01 Staging Egress-Isolation Proof Plan

**Review date:** 2026-10-19  
**Repository:** `/data/data/com.termux/files/home/mediaforge-git`  
**Branch / HEAD:** `main` / `c51b87a` (`Polish VideoFetch UI and workflow animations`)  
**Current status:** **MF-01 OPEN — BLOCK RELEASE**  
**Scope:** Read-only repository/report review and this report only. No production or infrastructure changes were made.

## Executive summary

The repository and prior MF-01 reports do not contain a staging worker, gateway implementation, firewall policy, or staging test evidence. The current tree still has multiple Render-side media execution paths. A worker cutover must cover metadata extraction, job downloads and fallbacks, preview generation, diagnostics, startup binary probes, and stored-artifact FFprobe verification—not only the normal queue call.

The proposed Squid option is not proven safe by its ACL documentation. Before application dispatch changes, an operator must prove in isolated staging that direct media-sandbox egress is blocked and that the gateway’s validated numeric destination is exactly the address connected to. No staging or external security tests were run for this review. **MF-01 remains open; release remains blocked.**

## Repository state and preservation

Preflight evidence:

- `pwd` and `git rev-parse --show-toplevel`: `/data/data/com.termux/files/home/mediaforge-git`
- `git status --short`: existing modified files: `.env.example`, `SSRF_EGRESS_LIMITATIONS.md`, `server.ts`, `server/auth.ts`, `server/ffmpeg.ts`, `server/operationalSecurity.ts`, `server/redis.ts`, `server/regressionTests.ts`, `server/ytDlpService.ts`, `src/components/ActiveJobModal.tsx`, `src/context/AppContext.tsx`, `src/views/AdminView.tsx`; untracked `mf-01-staging-review-prompt.md` and `security-reports/`.
- Branch: `main`; `git log -1 --oneline`: `c51b87a Polish VideoFetch UI and workflow animations`.
- No staged changes (`git diff --cached --stat` was empty). Existing unstaged and untracked work was preserved. No ignored build output was removed or modified.
- Requested target did not exist before creation; this report is the only file created.

## Reports and files reviewed

Reviewed the current prompt, all existing security reports, and `SSRF_EGRESS_LIMITATIONS.md`:

- `security-reports/production-security-audit-2026-10-19.md`
- `security-reports/production-security-remediation-2026-10-19.md`
- `security-reports/mf-01-production-egress-verification-2026-10-19.md`
- `security-reports/mf-01-infrastructure-options-2026-10-19.md`
- `security-reports/mf-01-isolated-worker-implementation-plan-2026-10-19.md`
- `security-reports/mf-01-preimplementation-review-2026-10-19.md`
- `SSRF_EGRESS_LIMITATIONS.md`

Current source review and reference searches covered:

- `server.ts`: startup validation, analyze/metadata route, preview pre-warm, job creation, social-download route, preview serving/generation, diagnostic preview route, shutdown.
- `server/queue.ts`: job creation, immediate processing, artifact read/upload/verification, cancellation, status and cleanup.
- `server/ytDlpService.ts`: metadata `execFile`, download `spawn`, retry/fallback branches, proxy arguments/environment, FFmpeg/FFprobe subprocess helpers and process cleanup.
- `server/ffmpeg.ts`: `generateMediaFile`, yt-dlp call, direct-stream validation, FFmpeg/FFprobe, binary bootstrap helper and per-job path handling.
- `server/socialDownload.ts`, `server/easyDownService.ts`, `server/providers.ts`: metadata/provider requests and yt-dlp fallback.
- `server/outboundHttp.ts`, `server/upstreamValidator.ts`, `server/security.ts`, `server/mediaEgressRoutes.ts`: DNS validation, pinned Node HTTP transport, redirect handling and public proxy/inspection paths.
- `server/verifier.ts`: stored artifact verification and FFprobe/read paths.
- `server/db.ts`, `server/postgres.ts`, `server/redis.ts`, `server/supabase.ts`: job persistence/cache, storage uploads and configured bucket size behavior.
- `server/jobAccessRoutes.ts`, `server/jobAuthorization.ts`: status/cancel/download ownership gates.
- `Dockerfile`: production image/process setup; no worker/gateway or network policy was found in the reviewed repository deployment material.

No `.env`, runtime environment values, cookies, proxy credentials, or production dashboard data were read.

## Processing-path inventory

| Path and source symbol | Caller / execution environment | User-controlled input and network/process capability | Required migration or disablement |
|---|---|---|---|
| `ytDlpService.validateServerEnvironment()`; `server.ts:98-100`, `server/ytDlpService.ts:424-487` | App startup in Render; executes yt-dlp, FFmpeg and FFprobe version probes. | No media URL is required for version probes; subprocess execution remains in Render. | Replace with worker readiness/version report; remove media binary dependency/probes from Render runtime. |
| `ytDlpService.getMetadata()`; `server.ts:820`, `server/ytDlpService.ts:893-1097` | Analyze/convert API executes yt-dlp via `execFile`; metadata failure may call RapidAPI fallback. | Normalized user URL is passed to yt-dlp; extractor performs DNS/redirect/secondary requests. RapidAPI uses fixed API transport with URL data. | Delegate yt-dlp metadata to sandbox via bounded authenticated worker operation or use guarded fixed-provider metadata without yt-dlp. Preserve current API response shape/latency contract. |
| Analyze preview pre-warm; `server.ts:412-420` | Metadata route calls `generateMediaFile` asynchronously in Render. | Derived media source URL/thumbnail; yt-dlp and FFmpeg/FFprobe execute indirectly. | Remove optimization or enqueue/dispatch worker task subject to authorization and quota. |
| Normal job queue; `BackgroundJobQueue.createJob/processJob`; `server/queue.ts:32-99,138-215` | Render process-local queue starts immediately; calls generator, FFprobe/validation, reads entire output via `readFile`, uploads through server Supabase client, verifies and signs. | Job source URL and output options; yt-dlp makes independent outbound requests. Full file is buffered in Render memory. | Replace process-local execution with durable dispatch; worker generates/verifies; use bounded streaming or supervisor-only storage transfer; Render owns final state and download authorization. |
| yt-dlp download/retries/fallbacks; `executeDownload`; `server/ytDlpService.ts:1141-1528` | Called through `generateMediaFile`; uses `spawn`, two format attempts, then RapidAPI stream-resolution fallback. | User source URL; yt-dlp redirects, fragment/CDN/extractor requests. Fallback resolves media URL then `fetchAndValidateMediaStream` uses Node safe transport; FFprobe and FFmpeg run after fetch. | Move all media download and processing branches to worker. A direct media fetch fallback must not remain on Render merely because it is Node HTTP. Keep only fixed-host provider API request in Render if safe and separated from media transfer. |
| Main processing gateway; `generateMediaFile`; `server/ffmpeg.ts:405-590` | Called from queue and direct preview/diagnostic paths. Invokes yt-dlp; FFmpeg receives local paths for transcode/trim/remux; FFprobe verifies local media. | Source URL and format/title/trim options; yt-dlp is network-capable. FFmpeg/FFprobe parse media. | Worker-only generator; fixed executable and argument schema; sandbox network policy applies to every child regardless of expected local input. |
| Social download fallback; `server.ts:491-550`, `server/socialDownload.ts:270-348` | Public API first uses fixed RapidAPI endpoint; fallback calls yt-dlp metadata/extraction. | User URL may be included as data to the fixed RapidAPI endpoint; fallback invokes yt-dlp on it. | Keep the fixed API call in Render only over `requestSafeHttp`; send any yt-dlp request and resulting media fetch to worker. Do not give the media sandbox the RapidAPI key. |
| On-demand preview; `server.ts:1259-1426` | Public preview route calls `generateMediaFile` if cache/output is missing, then validates with FFprobe and streams local file. | Request `id`/`url` affects preview key; source may come from analyzed metadata/job. It can cause yt-dlp/FFmpeg work in Render. | Worker-only generation or disable route generation; bind preview artifact to authorized job/owner and avoid duplicate/unbounded preview work. |
| Preview diagnostic; `server.ts:2054-2122` | `/api/diagnostics/preview-test` calls generator with a fixed public sample, FFprobe and Supabase signing. | Fixed sample URL; subprocesses and storage actions execute inside Render. Route protection/exposure must be verified from deployed middleware. | Remove from production route table or make staging-only; no production diagnostic should start media processing. |
| Artifact verification; `server/queue.ts:209`, `server/verifier.ts:43-237` | After upload, Render verifier reads the stored artifact and invokes FFprobe. | Stored media content is processed in Render; file read can consume memory/disk. | Perform complex media parsing in isolated worker. Render verifies lease, object key, bounded size/checksum and state without parsing untrusted media. |
| Binary provisioning helpers; `ensureYtDlpBinary`; `server/ffmpeg.ts:28-80`; curl installer `server/ytDlpService.ts:388-408` | Helper definition found and imported; search found no call to `ensureYtDlpBinary`. Runtime curl fallback is part of detector fallback logic. | Fixed GitHub release URL, not user-controlled; network request or executable startup. | Prove unreachable in production or remove from Render runtime. Pin and bake worker binaries during image build; do not runtime-download “latest”. |
| Node SSRF-safe URL/provider routes; `server/outboundHttp.ts`, `server/upstreamValidator.ts`, `server/mediaEgressRoutes.ts`, `server/providers.ts`, `server/easyDownService.ts`, `server/socialDownload.ts` | Render processes public URL proxy/inspection, provider metadata, fixed EasyDown/RapidAPI calls, and redirects through guarded transport. | Some endpoints accept user URLs; `requestSafeHttp` validates/pins Node connections and revalidates redirects. These are not yt-dlp subprocesses, but are separate user-influenced Render network paths. | Keep required Node control/provider paths on safe transport; explicitly decide whether `/api/*proxy*` media streaming remains supported on Render. Do not claim all user media network activity is sandboxed if these routes remain. Keep provider API destination fixed. |

The `requestSafeHttp` Node transport is distinct from yt-dlp. It validates addresses and redirects for callers that use it; it does not constrain child-process sockets. Existing source and reports establish application-side `--proxy` and clearing of `NO_PROXY`/`no_proxy` on the primary metadata/download calls, not network-level enforcement. The media child environment should explicitly remove all uppercase/lowercase `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, and `NO_PROXY` variants except a fixed proxy configuration, and fail closed on proxy/DNS failure. Confirm the actual yt-dlp runtime honors the configured proxy; environment behavior is not proof.

## Required network-boundary diagram

```text
Browser ─HTTPS─> Render control plane
                  ├─ authenticate, authorize owner, create/read/cancel durable job
                  ├─ fixed worker API and durable Neon state
                  └─ existing safe Node provider/API traffic (no media child)
                       ▲                         ▲
                       │ fixed authenticated    │ bounded artifact receive,
                       │ supervisor routes       │ or fixed-host scoped upload
                 Worker supervisor ─────────────┘
                    │ separate namespace / identity; no user URL dialing
                    │ local file pipe only
                    ▼
              Per-job media sandbox ──only──> Egress gateway ──> Public media sites
              yt-dlp / FFmpeg / FFprobe          │
              no DB/Supabase/Render key           └─ resolve, filter and IP-pin
```

The worker host/provider firewall permits new egress only to the gateway listener. The supervisor and media sandbox have different network identities and gateway policy. Only the media sandbox receives user URLs. The supervisor reaches only fixed Render endpoints and a configured storage endpoint; user data cannot alter those destinations. Sandbox has no direct DNS, database credentials, unrestricted control-plane credentials, upload capability, or worker secrets. Artifact delivery should preferably be a bounded streaming supervisor-to-Render endpoint; if signed Supabase/TUS is selected, it is only supervisor-held and restricted to a server-derived path.

## Gateway and network-isolation requirements

1. **Worker edge:** provider firewall default-deny for all new IPv4 and IPv6 egress except gateway IP and exact proxy port. Host firewall and per-job namespace repeat the deny; no secondary interface, host-network namespace, generic NAT, route, direct DNS, or public resolver exception is available to the media sandbox. Disable IPv6 in the sandbox if not needed; otherwise prove equivalent IPv6 filtering.
2. **Protocols:** permit only tested HTTP proxy requests and TLS CONNECT to approved destination ports. Deny raw TCP, SOCKS, FTP, arbitrary UDP, UDP/443 QUIC, direct DNS/DoH, tunnels and unknown IP protocols. If a provider needs an exception, prove ownership and risk-review it; never permit metadata/private ranges.
3. **Gateway DNS and sockets:** gateway resolves A and AAAA for each connection; canonicalizes IPs; rejects the entire answer set if any answer is prohibited; connects to the exact validated numeric address without another hostname lookup. Preserve hostname for TLS SNI/certificate validation. Record both resolution set and numeric socket peer. Re-evaluate every new connection and redirect.
4. **Destination denials:** include loopback, RFC1918, IPv4 link-local, shared-use, unspecified, multicast, reserved, documentation/benchmark, provider metadata/control endpoints, IPv6 loopback/ULA/link-local/multicast/unspecified, IPv4-mapped IPv6, transition/tunnel ranges and alternate numeric IPv4/IPv6 representations. Maintain policy from authoritative address registries; review policy updates.
5. **DNS changes and redirects:** no DNS cache or hostname ACL may allow a different address to be used after validation. A redirect is a new destination decision. HTTPS CONNECT hides the response body/redirect from the gateway, so prove yt-dlp opens the redirected host through a new CONNECT and that a network-layer direct deny protects against any client bypass.
6. **Proxy variables/failure:** pass a fixed `--proxy`/transport argument configured by operator. Remove all inherited proxy variables and `NO_PROXY` case variants in the sandbox. Do not take a proxy URL from the job. Gateway-down, DNS-timeout, invalid answer or proxy authentication/certificate failure must fail the job; no retry may fall back to direct networking.
7. **Logs:** proxy and worker logs may contain policy decision, job correlation ID, hostname and IP classification only as needed. Redact URL query/path where it can contain credentials, cookies, signed URLs, HMACs, proxy auth and authorization headers. Test redaction with synthetic canary values.

Squid’s [ACL documentation](https://www.squid-cache.org/Doc/config/acl/) shows destination-IP ACL support; it does not prove that all answers are checked, mixed answers fail closed, or the validated IP equals the socket peer. If this invariant cannot be demonstrated for the exact proxy version, replace it with an auditable gateway whose resolver and dialer share the same validated numeric address; retain a gateway host firewall deny as defense in depth. Do not accept a proxy variable, static IP, normal download, or unit test as the proof.

## Controlled staging test matrix

All network tests below are **planned only**. The test owner must operate the DNS zone, HTTP/TLS servers and public sink endpoints, or obtain explicit authorization for them. Run from the real media namespace in isolated staging—not from ordinary Termux or production. A denied destination must never be contacted; capture sink-side logs proving zero arrival. Use reserved/owned test fixtures that safely simulate prohibited address classes rather than probing actual internal, metadata or unrelated third-party systems.

| Test | Setup | Expected result | Evidence and pass/fail |
|---|---|---|---|
| Direct IPv4 egress | From the exact media namespace, attempt a harmless TCP connection to an operator-owned public sink with proxy unset. | Kernel/provider policy blocks before connection. | Worker firewall/host rule, packet/flow evidence, sink sees no connection = pass; any established session or sink request = fail. |
| Direct IPv6 egress | Same test over IPv6; if unsupported, show IPv6 disabled with no route/interface in sandbox and prove no alternate path. | Blocked or demonstrably unavailable. | Namespace route/config plus owned sink logs; an untested IPv6 route = fail. |
| TCP, UDP, DNS, QUIC bypass | Owned listeners for TCP, UDP and DNS; controlled QUIC endpoint if available. Try direct and common ports from sandbox. | Only gateway listener is reachable; no direct DNS/UDP/QUIC. | Firewall counters/packet capture and sink logs show deny/no arrival; any direct packet reaching destination = fail. |
| Proxy environment bypass | Set synthetic `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, lowercase forms and `NO_PROXY`/lowercase values to owned test proxies/hosts; submit job data containing fake proxy fields. | Supervisor ignores job fields; sandbox uses fixed policy; no direct egress and no alternate proxy route. | Environment allowlist inspection, gateway logs and owned decoy proxy logs; only intended gateway observed = pass. |
| Public-only DNS answers | Owned hostname returns public test A and/or AAAA address. | Gateway succeeds and connects to an allowed owned fixture. | DNS answer log equals gateway socket-peer log and sink accepts request = pass. |
| Mixed A/AAAA | Owned DNS fixture returns one allowed and one prohibited test address in the same answer set. | Entire destination rejected; no attempt to prohibited sink. | Resolver set, deny reason, socket trace, sink logs; any connection to prohibited member = fail. |
| DNS answer changes/rebinding | Owned resolver returns a public test IP for first lookup, then a prohibited test IP before connect/retry. | Gateway uses only a freshly validated pinned address or rejects; never connects to prohibited address. | Query sequence plus actual peer; mismatch/unobserved lookup = fail. |
| Redirects | Owned HTTP server redirects to a different owned host; second fixture redirects to a prohibited test address. Also test multiple hops/loop. | Each hop revalidated; prohibited/loop rejected, allowed chain bounded. | Per-hop proxy request and actual peer logs; any prohibited sink arrival = fail. |
| HTTPS CONNECT and redirect | Owned TLS server issues redirect; another redirects toward a prohibited owned sink. | Each redirected hostname causes a new CONNECT, validated and pinned by gateway. | CONNECT target, resolver answer, socket peer and sink logs; hidden/unproxied hop = fail. |
| Numeric/IP representation | Owned test URLs exercise IPv4 literals in canonical, integer, shortened, octal/hex forms where clients accept them; IPv6 literals, mapped IPv6 and transition addresses. | All normalize to the same policy class and prohibited cases reject. | Parsed canonical target plus peer; any representation reaches a prohibited sink = fail. |
| Address-class and port policy | Controlled fixtures simulate loopback/private/link-local/unspecified/multicast/reserved/metadata classes; test allowed public ports and prohibited ports only in staging. | All prohibited classes and ports fail closed; approved public fixture works. | Gateway decision plus zero sink arrival. Do not send requests to real internal/metadata targets. If safe simulation cannot represent a class, mark that class untested and keep MF-01 open. |
| yt-dlp metadata and extractor | Synthetic supported media fixture and controlled redirect/secondary extractor endpoints. | Every request is visible through gateway; no direct egress; extractor succeeds for allowed fixture. | Correlated gateway events for metadata, redirects, helper/CDN/fragment flows and worker packet denies; unexplained request = fail. |
| yt-dlp preview and download | Exercise every preview/prewarm path, standard formats, fragments, CDN and fallback path with owned content. | Work occurs only in sandbox; each connection uses gateway. | Process inventory, gateway traces and API contract result; any Render child process = fail. |
| FFmpeg / FFprobe | Give only local test media; include network-shaped input URL in a harmless controlled fixture if behavior can be tested safely. | FFmpeg/FFprobe work locally and network requests from sandbox are blocked by network layer. | Process arguments, namespace egress traces and controlled sink logs; any direct fetch = fail. |
| Gateway outage / DNS failure | Stop staging gateway or make controlled resolver unavailable. | Job fails/retries within bounded policy; no direct fallback; worker does not retain stale lease indefinitely. | Worker logs/state transitions, firewall counters, no sink arrival; direct connection or indefinite claim = fail. |
| Limits, cancellation, cleanup | Synthetic bounded jobs with controlled timeout/cancel, size/output and disk pressure cases. | CPU/RAM/PID/disk/concurrency/runtime/stdout/stderr/size caps hold; cleanup removes only attempt-owned files. | Resource metrics, before/after filesystem inventory and no unrelated-file deletion. |
| Safe logs | Use synthetic canary values in URL query, cookie, authorization, proxy and upload token fields. | Values do not appear in app/worker/proxy logs or error output. | Redacted log scan; any canary value present = fail. |

### FFprobe/artifact-control tests (after network milestone)

Prove worker output has an expected object key and attempt ID; maximum bytes are enforced while streaming; actual content/container is verified in the isolated worker; Render checks checksum, key, lease and current state before `READY`; overwrite and cross-job access fail; cancellation/lease-expiry uploads become tracked orphans and are removed by exact key only. Test storage/global/bucket limits against the actual staging plan. Large files should use bounded streaming or TUS; do not `readFile` the full artifact into a Render buffer.

## Job-state and artifact requirements before cutover

- Replace `db.jobs` as the authority for status, ownership, cancellation, downloads and admin queries. Current `server/queue.ts` starts work immediately after inserting a Map entry, while `saveJob`/`getJobs` persist/read snapshots and Redis `cacheJob` is cache, not a durable queue.
- Persist job and dispatch/outbox record atomically; no dispatch on Postgres failure. Claim one row with atomic lease owner/token/expiry/attempt; heartbeats and completion require current nonexpired lease. Cancellation wins races; stale worker cannot set READY. Use idempotent create/claim/complete and bounded retry/reaper.
- Worker has no Neon/database credentials. Redis remains cache/rate-limit; outage cannot relax worker authentication, ownership or job authorization.
- Supervisor only receives fixed Render paths and fixed Supabase host/path. Media sandbox gets no supervisor, DB, Redis, service-role or signed upload credential. Reject user-controlled callback/upload destinations.
- Verify owner/capability at Render before dispatch and on every status/cancel/download. Worker never chooses owner or object path. Keep bucket private and prevent overwrite with immutable attempt key or no-upsert behavior.
- Supabase documents `createSignedUploadUrl` tokens as valid for **2 hours** ([official API reference](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl)); its resumable upload URLs can remain valid up to **24 hours**, and TUS is recommended above 6 MB ([resumable upload guide](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)). Treat each as a bearer capability; keep it supervisor-only, bind to server-derived path, expire/reconcile abandoned attempts, and test reuse/wrong-path behavior in staging.
- Supabase file limits depend on project tier and global/bucket settings; current docs state Free projects cannot exceed 50 MB ([file limits](https://supabase.com/docs/guides/storage/uploads/file-limits)). This repository has a `server/supabase.ts` bucket-creation default of 25 MB while media output code allows up to 512 MiB. Actual production plan, bucket and limits are unknown; do not assume 512 MiB staging/production uploads work.
- Preserve public API/front-end status, cancel, preview and download response contracts. If current synchronous metadata extraction moves to a worker, retain a bounded synchronous RPC or explicitly design/test an approved contract transition. Rollback stops worker claims and disables media work; never restore unrestricted in-process processing.

## Evidence actually obtained vs. tests planned

**Actually performed:** read-only Git state/log/diff checks; repository-wide targeted `rg` searches; source excerpts and symbol-reference checks; read the existing audit/remediation/MF-01 reports and `SSRF_EGRESS_LIMITATIONS.md`; consulted official provider/storage/proxy/PostgreSQL documentation. No production secrets or environment values were accessed.

**Not performed:** no unit test suite, subprocess integration, staging deployment, proxy request, DNS fixture, socket/packet test, firewall inspection, storage upload, production request, or external security test. No gateway, worker, or staging infrastructure exists as verified in the repository. Thus **zero staging acceptance tests have passed**. Tests in the matrix above are plans, not results.

## Blockers and unresolved decisions

1. No staging worker/gateway, actual firewall configuration, proxy build/version/configuration, or network evidence is available.
2. Render’s documented outbound IPs identify traffic source; private networking and inbound IP rules do not establish destination filtering or prevent subprocess direct egress. No authorized Render dashboard evidence was inspected.
3. Hetzner documents that metadata requests are answered locally and bypass Cloud Firewall; DNS/rescue traffic and private Cloud Network behavior also need explicit containment. Cloud allow rules alone are insufficient ([Hetzner Firewall FAQ](https://docs.hetzner.com/cloud/firewalls/faq/)).
4. Squid’s ACL documentation does not prove DNS-to-socket pinning, mixed A/AAAA rejection or redirect safety. Select a gateway implementation only after it can expose validated address and actual peer evidence; otherwise use a gateway resolver/dialer that pins one validated numeric IP and a host firewall deny.
5. Render-side paths in the inventory remain active in current source. In particular, `/api/preview`, preview pre-warm, `/api/diagnostics/preview-test`, analyze/social yt-dlp metadata/fallbacks, startup binary probes, normal queue processing, and `verifyDownloadArtifact`/FFprobe must be migrated or disabled.
6. `db.jobs` remains a process-local source used by status/cancel/download/admin flows. No durable atomic claim/lease protocol is present; persistence failure is swallowed in queue creation.
7. Upload route is undecided. Supabase signed capabilities are not seconds/minutes-lived and TUS URLs may persist up to a day. Production storage plan, size limits, private policy, overwrite setting and transfer cost are not verified.
8. Exact worker/sandbox network namespaces, supervisor-only storage/control paths, proxy auth, worker credential rotation/replay store, cookie support, cost/region/availability, bandwidth and operational ownership remain unresolved.

## Objective MF-01 acceptance criteria

Do not close MF-01 until evidence from the production-equivalent revision and exact staging infrastructure proves all of the following:

1. Every production processing path above is inventoried and migrated to the worker or explicitly disabled. Render has no yt-dlp, FFmpeg or FFprobe media execution—including startup probes, metadata, preview, diagnostics, fallbacks and artifact parsing.
2. Same media sandbox cannot directly reach owned IPv4 or IPv6 sinks over TCP, UDP, DNS, QUIC or alternate proxy settings. Firewall/host/namespace evidence shows gateway-only egress; owned sinks record no direct traffic.
3. Gateway rejects prohibited ranges, ports/protocols, mapped/transition/alternate addresses and mixed A/AAAA responses. DNS-change and redirect tests fail closed. The gateway’s validated numeric IP is demonstrably identical to the actual socket peer on each connection.
4. Every yt-dlp metadata, redirect, preview, download, fragment, extractor helper and CDN request is observed through the gateway; HTTPS redirects create a new checked CONNECT; no alternate direct socket succeeds. FFmpeg/FFprobe have no usable network path.
5. Gateway/DNS failure never falls back to direct egress. Worker limits, timeouts, cleanup and secret-free logs pass controlled staging tests.
6. Durable state, ownership, leases, replay protection, cancellation races, stale-worker rejection, idempotent completion, no-dispatch-on-persistence-failure and orphan cleanup pass separately before cutover.
7. Artifact scope, no-overwrite, size/type/checksum, private bucket, actual upload limits, signed/TUS capability lifetime and frontend/API compatibility are verified in staging.
8. Operator provides sanitized provider firewall/route config, gateway version/config hash, socket-peer/DNS/redirect evidence, sink logs, job/auth/artifact test results, and cost/storage settings. No claim relies only on documentation, a proxy URL, or ordinary download success.

Any unknown path, untested IP family/protocol, unresolved provider exception, mismatch between validated and connected IP, direct sink arrival, storage capability leak, or staging test failure means **MF-01 OPEN — BLOCK RELEASE**.

## Exact next action

The owner/operator should first provision or designate an isolated, non-production worker and gateway with permission to inspect firewall and host-network policy, plus DNS/HTTP/TLS fixtures and sink endpoints that the owner controls. Before any application implementation or production changes, produce the Milestone 1 proof bundle: gateway-only IPv4/IPv6 egress, direct TCP/UDP/DNS/QUIC denial, proxy DNS/actual-peer pinning, mixed-answer and redirect rejection, and supervisor/media-sandbox separation. If the selected host firewall cannot contain its documented metadata/provider exceptions or the selected gateway cannot prove connection pinning, choose another provider/gateway. Do not run these checks from Termux or production.

**No application source, production settings, infrastructure, commits, pushes, or deployments were changed. MF-01 remains open and release status remains BLOCK RELEASE.**
