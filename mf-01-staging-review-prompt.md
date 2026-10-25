# MediaForge MF-01: Staging Egress-Isolation Review

## Objective
Prepare the next security milestone for MediaForge. MF-01 remains OPEN and release status remains BLOCK RELEASE until real staging evidence proves network isolation.

## Safety rules
- Read-only repository inspection and creation of one new report only.
- Preserve all tracked and untracked changes, existing reports, and ignored build outputs.
- Never run git reset, git clean, checkout, or revert.
- Do not edit application source, manifests, lockfiles, deployment configuration, secrets, firewall rules, DNS, or production settings.
- Do not install software, create paid infrastructure, commit, push, deploy, or contact arbitrary external targets.
- Do not claim tests passed unless actually executed against isolated, controlled staging infrastructure.
- If a report with the requested name already exists, do not overwrite it; choose a unique filename.

## Phase 1: Verify repository state
Record:
- pwd
- git status --short
- git branch --show-current
- git log -1 --oneline

Inspect the existing security reports, especially:
- security-reports/mf-01-preimplementation-review-2026-10-19.md
- security-reports/mf-01-production-egress-verification-2026-10-19.md
- security-reports/mf-01-isolated-worker-implementation-plan-2026-10-19.md

If any report is missing, state that fact instead of assuming its contents.

## Phase 2: Inventory every processing path
Search source code and references for:
- yt-dlp, ytDlpService, executeDownload, spawn, exec, child_process
- FFmpeg and FFprobe
- metadata, previews, pre-warming, diagnostics, startup checks
- redirects, URL fetching, DNS resolution, background tasks
- artifact reads, Supabase uploads, and alternative processing routes

For each path, record file and symbol, caller, execution environment, user-controlled inputs, network capability, and proposed migration or disablement. Distinguish verified facts from uncertain assumptions. Do not infer a function is unused without checking references.

Pay special attention to Render-side processing paths and any FFprobe or preview paths that could bypass the proposed worker.

## Phase 3: Define the isolation proof
Describe separate boundaries for:
1. Render control plane.
2. Worker supervisor.
3. Per-job media sandbox.
4. Destination-filtering gateway.
5. Artifact storage/upload.

The media sandbox must not have direct internet access. It must have no database credentials or unrestricted control-plane credentials. The supervisor must not let user-controlled URLs influence its own network destinations.

Specify how the gateway will:
- Validate every IPv4 and IPv6 DNS answer and reject mixed safe/unsafe answers.
- Pin the validated numeric IP to the actual outbound socket connection.
- Revalidate redirects and every new connection.
- Reject loopback, private, link-local, metadata, multicast, reserved, mapped IPv6, transition ranges, and alternate numeric IP forms as applicable.
- Restrict destination protocols and ports.
- Fail closed when DNS or the gateway fails, with no direct-connect fallback.
- Prevent bypass through HTTP_PROXY, HTTPS_PROXY, ALL_PROXY, NO_PROXY and lowercase variants.
- Avoid logging credentials, cookies, signed URLs, or authorization headers.

Do not assume that using --proxy or configuring Squid proves isolation. Explain what must be tested about DNS resolution, actual socket destinations, redirects, and HTTPS CONNECT behavior.

## Phase 4: Build a controlled staging test matrix
For each test, document setup, expected result, evidence, and pass/fail criteria.

Include:
- Direct IPv4 and IPv6 egress denial from the actual media sandbox.
- Direct TCP, UDP, DNS, and QUIC bypass denial where applicable.
- Attempts to bypass the gateway using proxy environment variables.
- Prohibited destination classes and alternate numeric addresses.
- Mixed public/private DNS answers and DNS answer changes.
- Redirects to prohibited destinations.
- Evidence that the validated IP is the actual connected IP.
- yt-dlp metadata, previews, downloads, fragments, redirects, and extractor/CDN requests.
- FFmpeg/FFprobe network-capable paths.
- Gateway outage and DNS failure behavior.
- Resource limits, timeouts, cleanup, and safe logs.

Only test systems owned or explicitly authorized for staging. Do not probe unrelated public targets. Mark which tests require an infrastructure operator and must not be run from ordinary Termux.

## Phase 5: Record remaining architectural requirements
Document, but do not implement:
- Durable Neon/Postgres job authority instead of a process-local authoritative job map.
- Atomic job claims, leases, heartbeats, retries, cancellation, and conditional completion.
- Redis remains cache/rate-limit infrastructure, not the durable queue.
- No job dispatch when durable persistence fails.
- No remaining Render-side processing paths after cutover.
- Worker has no database credentials.
- Artifact upload scope, size/type/checksum verification, overwrite prevention, replay controls, and private storage.
- Signed upload tokens and resumable URLs are bearer capabilities; verify their expiry and scope using official documentation and controlled tests.
- Bounded streaming and cleanup instead of buffering entire media files in memory.

## Deliverable
Create:
security-reports/mf-01-staging-egress-proof-plan-2026-10-19.md

Include:
- Executive summary and current status: MF-01 OPEN — BLOCK RELEASE.
- Repository state and exact source files/symbols reviewed.
- Processing-path inventory.
- Network-boundary diagram.
- Gateway requirements and staging test matrix.
- Tests actually executed versus tests merely planned.
- Required evidence, blockers, unresolved decisions, and objective acceptance criteria.
- Explicit statement that no production or infrastructure changes were made.

If the target file exists, use a new non-conflicting filename.

## Closure criteria
Do not close MF-01 until evidence proves:
1. Every processing path is inventoried and migrated to the isolated worker or explicitly disabled.
2. The actual sandbox cannot bypass the gateway over relevant IPv4/IPv6 and TCP/UDP paths.
3. The gateway blocks prohibited destinations, mixed DNS answers, DNS changes, unsafe redirects, and alternate address forms.
4. The numeric IP validated is the IP actually connected to.
5. Gateway failure cannot trigger direct egress.
6. Controlled yt-dlp and FFmpeg/FFprobe staging tests use the enforced network path.
7. Durable job and artifact controls are separately tested before cutover.

## Final summary
Report the exact files inspected and report created, tests actually run, tests still requiring staging infrastructure, and any blockers. Confirm that application code, production settings, infrastructure, commits, pushes, and deployments were not changed.
