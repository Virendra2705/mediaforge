# MediaForge / VideoFetch Security Patch Plan

**Scope:** Read-only review of current source and a proposed patch plan. No source files were edited, no tests were run, and no external requests were sent.

## Checkout state

The checkout already has uncommitted changes in `server.ts`, `server/auth.ts`, `server/db.ts`, `server/postgres.ts`, `server/redis.ts`, `server/regressionTests.ts`, `server/types.ts`, `src/components/AuthModal.tsx`, and `.env.example`; `package-lock.json` is deleted. Findings below describe the current working-tree source. Preserve those existing changes when patching.

## Confirmed findings

### Critical — SSRF protections do not cover the actual outbound connection

- [`server/security.ts:123`](server/security.ts#L123) resolves and checks the initial URL, but `isPrivateIp` at line 35 does not cover all reserved IPv4/IPv6 ranges or IPv4-mapped IPv6 forms. More fundamentally, this check is separate from the later network connection, so DNS can change between validation and use.
- [`server/upstreamValidator.ts:389`](server/upstreamValidator.ts#L389) uses `fetch`; its manual redirect loop accepts each `Location` at line 417 without validating the destination or pinning the checked address to the connection. The timeout is cleared as soon as response headers arrive at line 398, so it does not bound reading a slow or endless body.
- [`server.ts:554`](server.ts#L554) exposes three unauthenticated proxy aliases. It validates only the URL scheme and calls `fetch` directly; it has no private-address, redirect, timeout, or response-size enforcement.
- [`server.ts:2380`](server.ts#L2380) exposes an unauthenticated media inspector that calls the upstream validator.
- For job URLs, validation at [`server.ts:874`](server.ts#L874) is also insufficient by itself: provider, yt-dlp, and FFmpeg paths may make their own connections. Application-side checks alone cannot guarantee egress safety for those subprocesses.

**Proposed fix:** centralize outbound URL policy, then make each HTTP connection use an approved resolved address while preserving correct Host and TLS SNI. Revalidate every redirect before connecting; reject disallowed schemes, credentials, ports as appropriate, and all non-global IPv4/IPv6 destinations, including mapped forms. Keep connection and streaming timeouts active through the body and enforce byte limits. Apply this policy to the proxy and inspector as well as application-controlled fetches. For yt-dlp/FFmpeg, add an enforced network egress boundary that blocks private, loopback, link-local, metadata, and reserved destinations; URL checks before subprocess invocation are defense in depth, not a substitute. Add SSRF tests with injected DNS/transport so they require no external network.

### High — Job IDs currently authorize status access; anonymous download links have a separate check

- [`server.ts:1404`](server.ts#L1404) returns the entire job object to any caller with its ID. The object includes source and storage details and, when ready, `downloadToken` and `downloadUrl`.
- [`server.ts:1440`](server.ts#L1440) lets any caller cancel any job by ID.
- The shared signed-URL helper at [`server.ts:664`](server.ts#L664) does enforce ownership for authenticated jobs. But jobs with `userId === 'usr_anonymous'` bypass that check at lines 704–731, so possession of a job ID is enough to request a signed URL.
- [`server.ts:1051`](server.ts#L1051) accepts an unsigned file request when neither signature query parameter is present. It also permits path candidates to be joined at lines 1159–1166 without enforcing containment within the intended job directory.
- [`server.ts:1325`](server.ts#L1325) validates a token, but `verifyDownloadToken` at [`server/security.ts:231`](server/security.ts#L231) does not consume it. This route also does not independently check ownership.
- The client intentionally supports anonymous jobs: [`src/context/AppContext.tsx:390`](src/context/AppContext.tsx#L390) creates a job without requiring a session, then polls by ID at line 446. A secure anonymous workflow therefore needs an explicit capability.

**Proposed fix:** create one job authorization helper and use it for status, cancel, signed URL generation, and file access. Authenticated users must own the job; admins may override. For anonymous jobs, mint a high-entropy per-job capability, return it once at job creation, and require it for each job operation. Store a hash or authenticated server-side representation of that capability, never return it with job status. Update the client to retain and send it. Require a valid signature or authorized capability for every file request, and resolve/contain paths with `realpath` or an equivalent boundary check. Make token consumption or replay behavior explicit.

### High — Public diagnostics can create work and access outbound services

- [`server.ts:2023`](server.ts#L2023), [`server.ts:2169`](server.ts#L2169), and [`server.ts:2298`](server.ts#L2298) have no `requireAdmin` guard. Their handlers create jobs or generate/process test media; the tests can trigger storage and upstream activity.
- The inspector at line 2380 is public and accepts a caller-selected URL, compounding the SSRF finding.
- `/api/diagnostics/supabase` is already admin-only at [`server.ts:1954`](server.ts#L1954).
- [`server.ts:1973`](server.ts#L1973) includes the configured Supabase URL in its admin response and logs it at line 2001. This is not the secret key, but is unnecessary environment detail.
- [`server.ts:1809`](server.ts#L1809) exposes database/cache status and operational counters publicly.

**Proposed fix:** remove the three job-generating diagnostics from production routes, or guard them with `requireAdmin` and a non-production check. Remove the arbitrary-URL inspector or place it behind the same controls and SSRF-safe transport. Keep only a minimal health endpoint public; make detailed status/diagnostics admin-only and redact environment URLs and connection details.

### High — Blog publishing is public

[`server.ts:1703`](server.ts#L1703) accepts unauthenticated blog posts and writes them to the active store. Add `requireAdmin` and validate field types, lengths, tags, and slug collisions.

### High — PostgreSQL TLS certificate verification is disabled

[`server/postgres.ts:53`](server/postgres.ts#L53) explicitly sets `rejectUnauthorized: false`. That permits a TLS connection without verifying the server certificate.

I found no checked-in deployment configuration (for example, container or platform deployment manifests) to establish how production supplies a CA certificate. `DATABASE_URL` is present as a configuration key, but I did not inspect secret values or contact the database. **Proposed fix:** enable certificate verification and use the platform’s trusted CA roots, with an explicit CA configuration only if deployment requires one. Verify the actual production trust chain during deployment validation; do not retain a “skip verification” fallback.

### Medium — Queue allows unbounded concurrent work and buffers full artifacts in memory

[`server/queue.ts:84`](server/queue.ts#L84) starts processing immediately for each created job, with no worker limit or backpressure. At line 163 it reads the entire output file into a `Buffer` before upload. Under concurrent or large downloads this can exhaust memory and disk. The garbage collector at line 342 expires jobs and deletes remote storage objects, but does not remove local job directories.

**Proposed fix:** introduce a bounded worker queue and per-user/IP admission limits; enforce maximum download/output sizes and stream uploads where supported. Remove local artifacts after upload/failure and on expiry, with safe path containment. Avoid logging source URLs or other sensitive job data.

### Medium — Production static hosting exposes the server bundle and source maps

[`package.json:8`](package.json#L8) builds `dist/server.cjs` with `--sourcemap`; production serves the entire `dist` directory at [`server.ts:2563`](server.ts#L2563). That makes server bundle/source-map artifacts potentially reachable as static assets.

**Proposed fix:** emit the server bundle and its map outside the public asset directory, disable the server sourcemap for production, and serve only the frontend asset directory or use an explicit static-file allowlist. Removing source maps therefore requires a build configuration change, not just a runtime route filter.

### Medium — Login lacks route-level rate limiting

[`server.ts:108`](server.ts#L108) calls password authentication without a rate limit. `checkRateLimit` exists, and `/api/analyze` uses Redis-backed limiting, but the login handler shown here does not. Add a bounded, distributed login limit with a safe local fallback, keying on normalized account plus trusted client identity. Confirm proxy trust configuration before relying on `req.ip`; do not use raw `X-Forwarded-For` as an identity.

### Medium — Database initialization can continue in memory after PostgreSQL failure

[`server/db.ts:126`](server/db.ts#L126) catches initialization errors and logs that it is using the memory store. In production this can make persisted state appear to work while writes are lost on restart or differ across instances.

**Proposed fix:** make production startup fail closed or clearly mark the service unready when PostgreSQL is required. Keep an explicit development-only memory mode if needed. Ensure health checks report readiness separately from liveness.

## Shared helpers and middleware

- `sessionMiddleware` is installed globally at [`server.ts:103`](server.ts#L103). It resolves the current account role from the DB at [`server/auth.ts:194`](server/auth.ts#L194); `requireAuth` and `requireAdmin` are suitable route guards.
- Add a shared **job authorization** helper rather than duplicating owner checks in each handler. It should account for an authenticated owner, admin, or valid anonymous capability.
- Extend the existing URL validation helper in `server/security.ts`, but ensure transport-level address pinning and redirect handling are implemented by the outbound HTTP layer. Use the same safe outbound fetch helper for proxy, inspector, and other server-side fetch paths.
- Existing rate-limit code in `server/security.ts` and Redis support can inform login/job admission limits, but do not trust forwarded IP headers unless Express proxy trust is deliberately configured.

## Regression tests needed

The project convention is a custom test array in [`server/regressionTests.ts`](server/regressionTests.ts), run by `npm test`. There are existing URL checks (Test 14) and authentication tests, but no focused coverage for job ownership, redirect SSRF, diagnostics access, TLS configuration, or queue bounds. I did **not** run the suite.

Add focused cases for:

1. URL policy rejecting all private/reserved IPv4 and IPv6 forms, mixed DNS answers, IPv4-mapped IPv6, DNS rebinding between validation and connection, and private redirect targets.
2. Proxy and inspector rejecting blocked destinations; timeout and byte caps applied through body streaming.
3. Job status, cancel, signed URL, and file access: owner succeeds; another user and unauthenticated caller fail; admin succeeds; anonymous capability succeeds only for its job; no job response contains tokens.
4. File-path traversal and sibling-job path rejection, including encoded separators and symlinks where applicable.
5. Diagnostics and blog publishing return unauthorized outside their allowed role/environment; public health reveals only intended fields.
6. TLS config rejects untrusted certificates and accepts the configured trusted chain, using a local test server rather than external services.
7. Queue concurrency, maximum artifact size, and local cleanup on success, failure, cancellation, and expiry.
8. Static production routing does not serve the server bundle or `.map` files.
9. Login rate-limit behavior and production database unready behavior.

## Compatibility risks

- Anonymous downloads and polling will need a client/server protocol update to carry the per-job capability. Existing ID-only anonymous jobs should fail closed; decide whether to let currently unexpired jobs finish during rollout.
- Tight egress rules may block legitimate media providers or CDN redirects. Maintain an explicit provider policy and test known supported redirects without allowing private destinations.
- Enabling PostgreSQL certificate verification may uncover an incomplete Termux or deployment CA trust store. Fix the trust configuration rather than disabling verification again.
- Moving `server.cjs` out of `dist` changes the build/start paths and may require deployment command updates.
- Adding queue bounds changes throughput and can cause admission errors under load; return a clear retryable response.

## Smallest safe implementation order

1. **Close immediate exposure:** require admin or disable production diagnostics; protect blog publishing; reduce public status output.
2. **Fix SSRF transport and egress controls:** shared safe fetch, redirect revalidation and IP pinning, then cover provider/subprocess networking.
3. **Fix job authorization end to end:** capability for anonymous jobs, shared owner checks, status/token redaction, mandatory file authorization, and path containment.
4. **Enable PostgreSQL certificate verification** after confirming the production CA chain.
5. **Bound queue resources and clean local artifacts.**
6. **Remove server bundle/maps from public static hosting** and add login rate limiting/readiness behavior.

## Single most useful next action

Implement the shared outbound URL/transport policy and apply it first to the public proxy and inspector; SSRF is the highest-impact exposure and the same helper can later protect other server-side fetches.
