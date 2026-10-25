# MediaForge / VideoFetch Production Security Audit

**Audit date:** 2026-10-19  
**Scope:** Read-only source review, local dependency and regression checks, and one low-impact production homepage request.  
**Release recommendation:** **BLOCK RELEASE.** High findings remain in current source: unauthenticated diagnostic processing endpoints and subprocess egress outside the Node SSRF controls. The public production instance could not be reached from this audit environment, so production behavior and deployment configuration are unverified.

## 1. Executive summary

The current source contains meaningful protections: HMAC-SHA256 session and storage signatures, per-job ownership/capability checks, safe job-status projection, timing-safe comparison, database TLS verification, DNS-pinned Node HTTP requests with redirects/limits, private-bucket creation when the bucket is absent, SQL parameterization in reviewed database methods, and 43 passing regression tests. `npm audit --omit=dev` and full `npm audit` report no advisories; TypeScript lint and production build succeeded.

One High-confidence source finding blocks release: yt-dlp subprocesses connect to user-selected URLs and extractor-derived hosts outside the Node pinned transport. The repository itself documents this residual SSRF/egress risk. The source also returns session bearer tokens to the browser and stores them in localStorage, exposing them to any successful same-origin script injection. Diagnostic route middleware was traced and confirmed to gate the diagnostic test endpoints; no unauthenticated diagnostic route finding is reported.

## 2. Repository and working-tree state

- Repository root: `/data/data/com.termux/files/home/mediaforge-git`
- Branch: `main`
- Commit: `c51b87a` — `Polish VideoFetch UI and workflow animations`
- Existing user change before audit: unstaged deletion of one blank line in `server/operationalSecurity.ts`; preserved unchanged.
- No staged changes were reported. No tracked `.env`, cookie file, PEM, key, or report path was found by the targeted tracked-file check. `.env.example` is tracked and contains placeholders only.
- Node: `v24.17.0`; npm: `12.2.0`; architecture: `aarch64` (Android/Termux).
- Package manager: npm (`package-lock.json`); a `bun.lock` is also present, so lockfile synchronization was not verified.
- Package scripts: `dev`, `build`, `preview`, `clean`, `test`, `lint`, `start`.
- Historical artifacts present: `mediaforge-security-patch-plan.md`, `SSRF_EGRESS_LIMITATIONS.md`. No `plans/technical-audit-report.md` was found in the enumerated source files.
- Deployment: Dockerfile exists; no Render YAML, CI workflow, Supabase policy/migration, or database migration files were found in the tracked file listing. Hosting dashboard and deployed revision were not available.

**Build side effect:** the requested `npm run build` generated/updated ignored `dist/` and `server-build/` outputs. This conflicted with the strict read-only requirement. They were not removed or modified afterward to avoid destroying potentially pre-existing ignored user data. `git status --short` still shows only the pre-existing tracked modification. The build's ignored output state should be reviewed by the owner.

## 3. Verified architecture and data flow

React/Vite client → Express API (`server.ts`) → URL validation (`server/security.ts`, `server/outboundHttp.ts`, `server/upstreamValidator.ts`) → provider metadata and/or yt-dlp → asynchronous in-process job queue (`server/queue.ts`) → temp media directory and FFmpeg/FFprobe → Supabase Storage when configured (otherwise local mode) → ownership/capability authorization and HMAC-signed same-origin download route.

Trust boundaries:

1. Browser URL and format/title inputs enter API schemas and validators.
2. Node HTTP calls use `requestSafeHttp`, resolve all DNS addresses, reject mixed or non-global answers, pin the selected IP, preserve TLS verification, validate redirects, and cap time/bytes.
3. yt-dlp receives the URL as an argument array (no shell) but performs its own DNS, redirects, extractor calls, and media fragment downloads; Node pinning is not applied to those connections.
4. FFmpeg generally receives local file paths and argument arrays; direct URL processing uses the safe stream path in reviewed call sites. Media parser isolation is not evidenced.
5. Job outputs are stored beneath job-specific paths; job access checks use owner ID or anonymous capability. Signed file routes check HMAC, job state, expiry, path match, and containment.
6. Supabase bucket privacy is only verified/created by application startup code when configured; actual production bucket policy was not inspected.

## 4. Threat model summary

| Threat | Attack path / prerequisites | Impact | Existing defenses / remaining concern |
|---|---|---|---|
| Unauthenticated attacker | Submit media URLs/jobs and public proxy/inspection requests | Compute, egress, storage, and provider cost; resource exhaustion | Rate limiting and URL guards exist in places. Route-specific quotas and queue bounds need a comprehensive confirmed inventory. |
| Malicious authenticated user | Submit crafted URL/format or poll/cancel another user's job | SSRF, resource abuse, cross-user data access | URL validation, per-job owner check, capability and path binding. yt-dlp networking bypasses Node egress pinning. |
| Cross-user attacker | Guess job ID or signed file path | Private media disclosure or cancellation | Owner/admin checks; capability hashes expire; HMAC signatures bind path and expiry. |
| Malicious redirects/DNS | Public URL resolves/rebinds or redirects to private target | Internal service access | Node transport pins validated DNS and revalidates redirect hops; subprocess path does not enforce it. |
| Compromised dependency/build | Malicious transitive package or build script | Credential theft, artifact compromise | npm audit is clean; no static supply-chain scanner was installed. Lockfile integrity was not independently verified. |
| Misconfigured production services | Public bucket, weak secrets, missing Redis/DB controls | Data disclosure, auth forgery, downtime | Source config has safe defaults in some places; actual dashboards/env/policies unavailable. |
| Cost/resource abuse | Repeated jobs, large outputs, extractor retries | CPU/disk/memory/provider expenditure | Some timeout/size/rate controls; queue capacity, per-account quotas and full cleanup behavior not established. |

## 5. Findings (sorted by severity)

### MF-01 — yt-dlp subprocess egress bypasses pinned SSRF transport

- **Severity / confidence:** High / High
- **Status:** Confirmed (source-level boundary gap)
- **Affected files:** `server/ytDlpService.ts:884-887, 1197-1203`; `server/outboundHttp.ts:145-180`; `SSRF_EGRESS_LIMITATIONS.md:3-9`.
- **Evidence:** yt-dlp is executed as a subprocess with the validated source URL, then performs its own DNS resolution, redirects, extractor-specific requests, and fragment/CDN requests. The repository's limitations document explicitly says subprocess connections are not pinned and calls for host-level egress restrictions.
- **Safe reproduction:** Source review only; no internal address or metadata endpoint was contacted. The `npm test` private-source tests show rejection before subprocess start for private initial URLs but do not validate every secondary connection.
- **Prerequisites:** Attacker can submit a URL accepted by the application and cause yt-dlp extraction/download; exploitability depends on yt-dlp/provider URL behavior and network reachability from the production host.
- **Impact:** SSRF to reachable private services, cloud metadata access, or bypass of destination policy through redirects and extractor/CDN URLs; potential credential exposure and internal service impact.
- **Production exposure:** Plausible from deployed architecture, not dynamically confirmed; production host/dashboard inaccessible.
- **Minimal fix:** Enforce outbound egress policy outside the process for Node and child processes (controlled proxy/firewall/network namespace), or route yt-dlp through a proxy that validates every destination and redirect. Preserve TLS verification.
- **Regression test:** Add subprocess integration tests using controlled local DNS/HTTP fixtures to prove every child request is restricted; test redirect and fragment destinations. Do not use real internal addresses.
- **Priority:** P0 before release; verify network-level enforcement.

### MF-02 — Session bearer token is exposed to JavaScript and localStorage

- **Severity / confidence:** Medium / High
- **Status:** Confirmed
- **Affected files:** `server.ts:164-177`; `src/context/AppContext.tsx:211-254`.
- **Evidence:** Login sets an HttpOnly cookie but also includes the session token in the JSON response. The frontend persists it in `localStorage` and sends it in Authorization headers. This removes the protection value of the HttpOnly cookie if same-origin script injection occurs.
- **Safe reproduction:** Inspect login response construction and frontend persistence. No account was used.
- **Prerequisites:** Any successful XSS or compromised same-origin script/dependency, or local browser profile access.
- **Impact:** Theft and replay of a valid session (up to the 72-hour token expiry), including administrator session takeover.
- **Production exposure:** Source behavior applies if this revision is deployed; deployed revision not verified.
- **Minimal fix:** Prefer cookie-only sessions with HttpOnly, Secure, SameSite and CSRF controls; remove token from response/localStorage. If bearer tokens remain necessary, use short-lived in-memory access tokens plus a protected refresh design.
- **Regression test:** Assert login JSON contains no token, cookie flags are correct, and browser storage contains no credential; test CSRF behavior on state-changing routes.
- **Priority:** P1.

### MF-03 — Authentication token expiry validation accepts missing/invalid `exp`

- **Severity / confidence:** Low / Medium
- **Status:** Potential hardening gap
- **Affected files:** `server/auth.ts:136-142`.
- **Evidence:** Expiry is rejected only when `claims.exp` is truthy and current time exceeds it. A properly signed token with no `exp`, or certain invalid falsy values, is accepted; the verifier does not validate required claim types or `iat`.
- **Safe reproduction:** Local code-level tests could construct a token using the configured test secret; no production secret or live account used. Existing tests verify tampering but not missing claims.
- **Prerequisites:** Attacker must possess `AUTH_SECRET` or exploit signing capability; absent secret, an external attacker cannot forge a valid token. This is therefore defense-in-depth, not a practical standalone bypass.
- **Impact:** A malformed signed token could be non-expiring if minted internally or by a component sharing the key.
- **Production exposure:** Conditional on key compromise or future token issuer behavior.
- **Minimal fix:** Require integer `exp`, `iat`, nonempty `sub`, and enforce maximum token age; continue checking signature before claims.
- **Regression test:** Signed fixtures missing each required claim, with wrong types, and expired/future times must be rejected.
- **Priority:** P3.

### MF-04 — Redis outage falls back to process-local rate limits

- **Severity / confidence:** Medium / Medium
- **Status:** Confirmed behavior; production impact depends on instance topology
- **Affected files:** `server/redis.ts:218-260`; `server/authRateLimit.ts:25-57`.
- **Evidence:** On Redis command failure the limiter uses an in-memory map. Each application instance has an independent counter, which is not a global limit and resets on restart. The auth middleware fails closed only if the check itself throws; this fallback ordinarily returns allowed/blocked locally.
- **Safe reproduction:** Existing tests cover auth rate limit identity and window behavior, not multi-instance or Redis outage behavior.
- **Prerequisites:** Redis unavailable or attacker distributed across application instances/IPs.
- **Impact:** Login and API abuse limits can be multiplied or reset, increasing brute-force and cost-abuse capacity during a dependency outage or horizontally scaled deployment.
- **Production exposure:** Conditional; actual Render instance count and Redis availability unavailable.
- **Minimal fix:** Decide explicitly which endpoints fail closed; use a shared durable limiter or an intentionally restrictive bounded fallback and alert on degradation.
- **Regression test:** Simulate Redis outage and multiple limiter instances; verify documented fail-open/closed policy.
- **Priority:** P2.

## 6. Positive controls verified in source/tests

- `server/outboundHttp.ts`: HTTP(S)-only, allowed ports, global-address filtering for IPv4/IPv6, mixed-DNS rejection, pinned address lookup, TLS verification, redirect revalidation, timeout and byte caps. Regression tests cover these behaviors.
- `server/jobAccessRoutes.ts` / `jobAuthorization.ts`: ownership, anonymous capability expiry/hash, signed path, job state/expiry and path containment; status output strips secrets.
- `server/security.ts`: HMAC-SHA256 storage signature includes normalized path and expiry and uses timing-safe comparison; stream-token map expires.
- `server/auth.ts`: HMAC signature checked before claims; known roles only; account record refreshes role; scrypt password hashing and timing-safe comparison. Password change/recovery endpoints are rate limited; recovery fails closed with 501.
- `server/postgres.ts`: TLS verification explicitly enabled and TLS overrides sanitized; parameterized SQL observed in reviewed methods.
- `server/supabase.ts`: server-side key selection; private bucket creation if absent; upload validates media signature and denies HTML; signed app URL defaults to 300 seconds. Actual existing bucket privacy/policies are not confirmed.
- `server.ts`: `trust proxy` false; `nosniff`, frame, and legacy XSS headers set. No CSP, HSTS, or explicit CORS middleware observed in inspected entrypoint.
- Subprocess command construction uses argument arrays and no explicit shell. yt-dlp timeout exists; captured stdout/stderr in long-running download spawn is appended without a byte cap, a resource-risk candidate for follow-up.

## 7. Tools, versions, commands, and outcomes

| Command/tool | Result |
|---|---|
| `pwd`, git root/status/branch/log/diff stats | Completed; one pre-existing unstaged change found. |
| `node --version`, `npm --version`, `uname -m`, `npm run` | Node 24.17.0, npm 12.2.0, aarch64; scripts enumerated. |
| `npm audit --omit=dev --json` | Exit 0; 0 reported vulnerabilities; 183 production dependencies (audit metadata). |
| `npm audit --json` | Exit 0; 0 reported vulnerabilities; 308 total dependency nodes (audit metadata). |
| `npm run lint` | Exit 0 (`tsc --noEmit`). |
| `npm test` | Exit 0; 43 passed, 0 failed. |
| `npm run build` | Exit 0; Vite and server build completed; generated ignored build directories (see working-tree note). |
| `curl --max-time 12 -sS -D - -o /dev/null https://mediaforge-qvr0.onrender.com/` | Exit 28 timeout, zero response bytes; no production headers/content obtained. |
| `command -v gitleaks semgrep osv-scanner trivy zap` | Not installed/not found. `curl` is present. |
| CodeQL | No authorized CI integration or local CLI evidence found. |

No dependency install/upgrade or scanner installation was performed.

## 8. Secret and supply-chain scan summary

- Targeted tracked-file scan found `.env.example` only; no tracked `.env`, `cookies.txt`, PEM, private key, or P12 file matched.
- `.gitignore` excludes `.env`, `.env.*` except `.env.example`, `temp_media/`, `node_modules/`, build outputs and local yt-dlp binary.
- No Gitleaks or equivalent scanner available; Git history was not exhaustively secret-scanned. No secret values were printed.
- Vite output was generated successfully, but no bundle/source-map secret scan was run. The project uses `VITE_ADSENSE_CLIENT_ID`, which is a public publisher identifier by design; no server secret exposure was proven.
- package-lock and bun.lock both exist; no lockfile consistency verification tool was available. npm audit checks the npm lock dependency graph only.

## 9. Test matrix

| Area | Evidence/status |
|---|---|
| SSRF address policy, redirects, DNS pinning, timeout/size/cancel | Passed offline regression coverage; yt-dlp secondary egress remains untested and uncontained. |
| Authentication signature/password, role gate, auth limiting | Passed covered local regression cases; token persistence in localStorage is confirmed by source. |
| Cross-user job authorization and anonymous capability | Passed local production-route tests. |
| HMAC storage token tampering/expiry/path scope | Passed local tests for invalid/tampered/expired/path traversal cases. |
| Command injection | Argument-array/no-shell source review; no dynamic payload tests needed; subprocess environment and OS sandbox unverified. |
| Path traversal/file isolation | Passed local containment tests; symlink and filesystem race cases not tested. |
| Resource limits/cleanup | Partial source review; no load test. Spawn output accumulation lacks visible cap. JSON body parsing allows 10 MB globally; URL-encoded parser uses Express defaults. |
| PostgreSQL TLS and readiness | Passed regression tests for TLS defaults and production persistence fail-closed behavior; no production DB connection made. |
| Redis failure behavior | Not fully tested; code falls back to memory limiter/cache. |
| Supabase access restrictions | Source says private and signed; production bucket policy not queried. |
| Headers/CORS/CSRF | Source review only; production request timed out; no explicit CORS middleware seen. Cookie SameSite=Lax mitigates some CSRF but is not a complete assessment. |
| Secret leakage | Targeted tracked-file check only; dedicated scanner unavailable; no exhaustive history/bundle scan. |

## 10. Production checks requiring owner access

- Confirm deployed commit and Render environment variables without exposing values.
- Confirm Render egress policy/firewall/proxy constrains Node and yt-dlp child processes.
- Inspect actual Supabase bucket privacy, RLS/storage policies, object overwrite behavior and service-role key scope.
- Confirm Neon role privileges, TLS endpoint settings and database backups.
- Confirm Upstash TLS/auth, retention, rate-limit behavior, and instance topology.
- Check production response security headers, cookies, CSP/HSTS, CORS, and deployment logs.
- Verify retention and cleanup of temp media, cookie files, logs, and old storage objects.

## 11. Historical findings

`SSRF_EGRESS_LIMITATIONS.md` explicitly documents the unresolved yt-dlp subprocess egress gap and recommends host-level enforcement. That remains unresolved in application source. `mediaforge-security-patch-plan.md` was present but treated as historical; its completion claims were not assumed. The working-tree deletion in `server/operationalSecurity.ts` removes only a trailing blank line and did not affect reviewed function logic.

## 12. Prioritized remediation plan

1. **P0:** Enforce and demonstrate network-layer egress filtering for every child process and Node request; validate with controlled local fixtures.
2. **P1:** Remove bearer session token delivery/storage in browser JavaScript; retain secure HttpOnly cookie session and add CSRF defenses for state changes.
3. **P2:** Define Redis outage rate-limit policy; prevent local fallback from multiplying auth and costly endpoint allowances across instances.
4. **P2:** Bound subprocess output accumulation and confirm child cleanup on cancellation/timeout; enforce queue concurrency, per-user quotas and file/disk limits.
5. **P3:** Require strict session claims and expiry; assess reducing the global 10 MB JSON limit and add CSP/HSTS after deployment topology validation.
6. **P3:** Run dedicated secret/history and static-analysis scanners in authorized CI; reconcile npm and Bun lockfiles.
7. Verify actual Render, Neon, Upstash and Supabase production configuration with owner access.

## 13. Rollback considerations

The audit made no code or configuration edits. Build output may be ignored and may have replaced pre-existing artifacts; inspect before cleanup. Any future egress-policy change should preserve required public media provider access and have a documented rollback path. Cookie-only auth migration should avoid abruptly invalidating active sessions without a planned expiry/rotation window.

## 14. Limitations and untested areas

No production response was obtained due to a 12-second connection timeout. No hosting dashboard, database, Redis, or Supabase account access was available. No real credentials/accounts were used. No intrusive production tests, load tests, fuzzing, or internal-address probes were conducted. Dedicated Gitleaks, Semgrep, OSV-Scanner, Trivy, ZAP, and CodeQL checks were unavailable. Full Git-history secret scanning, actual bucket policy inspection, subprocess network sandbox verification, filesystem symlink/race tests, and complete queue/quota validation remain outstanding.

## 15. Phase 1 completion gate

**Critical findings:** none confirmed.  
**High findings:** MF-01 (yt-dlp subprocess egress gap).  
**Medium findings:** MF-02 (bearer token in localStorage); MF-04 (Redis outage local limiter fallback).  
**Unavailable tools:** Gitleaks, Semgrep, OSV-Scanner, Trivy, OWASP ZAP, CodeQL CLI/authorized CI evidence.  
**Unresolved risks:** production egress enforcement, production bucket privacy/policies, Redis outage and queue resource controls, token exposure to JavaScript, incomplete secret/history scan.  
**Recommended remediation order:** P0 egress containment; P1 cookie-only session; P2 distributed rate limits and process/resource caps; P3 claim validation, parser/header hardening, and supply-chain scanning.

Phase 1 is complete. No Phase 2 changes have been made.
