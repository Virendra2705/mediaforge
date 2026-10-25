# MediaForge / VideoFetch Security Remediation Report

**Date:** 2026-10-19  
**Repository:** `/data/data/com.termux/files/home/mediaforge-git`  
**Branch / HEAD:** `main` / `c51b87a` (`Polish VideoFetch UI and workflow animations`)  
**Production deployment:** Not authorized and not performed.  
**Release decision: BLOCK RELEASE.** Application code now requires and uses an operator-supplied yt-dlp proxy in production, but no production proxy or network-egress policy was configured or verified. A URL validator or proxy argument alone does not constrain subprocess network destinations.

## 1. Scope and preservation

Remediations were limited to the explicitly approved Phase 2 findings. No dependencies were installed or upgraded; no secrets were accessed or printed; no external services were accessed or modified; no commit, push, publication, or deployment occurred.

The pre-existing unstaged deletion in `server/operationalSecurity.ts` remains byte-for-byte unchanged (only the trailing blank line is absent). The untracked Phase 1 report `security-reports/production-security-audit-2026-10-19.md` was preserved without edits. Ignored `dist/` and `server-build/` outputs were not removed. The required production build regenerated ignored build outputs.

Initial state: no staged changes; existing unstaged change only in `server/operationalSecurity.ts`; Phase 1 report untracked. Final status also includes the intended source changes and this new report.

## 2. Finding outcomes

| Original finding | Original severity | Outcome | Evidence / remaining limitation |
|---|---:|---|---|
| MF-01 — yt-dlp subprocess egress bypasses pinned transport | High | **Partially mitigated; still open** | Production startup now requires `YTDLP_PROXY_URL`; metadata and download invocations pass `--proxy`, clear `NO_PROXY`/`no_proxy`, disable playlists/cache, cap timeout/output/file size, and use bounded process concurrency. Tests verify proxy configuration handling and output bounds. No real proxy was configured or exercised, and Render network-level egress restrictions were not inspected. Release remains blocked. |
| MF-02 — bearer session token exposed to JavaScript/localStorage | Medium | **Fixed but not fully verified** | Login and `/api/auth/me` no longer return session tokens; auth middleware accepts only the HttpOnly cookie; frontend removed bearer use and clears legacy `mf_token`; cookie remains `HttpOnly`, production `Secure`, `SameSite=Lax`, 72-hour expiry; logout uses matching attributes; cross-origin mutation Origin is rejected. Regression tests verify cookie-only extraction and same-origin guard, and build passes. An end-to-end test of the real login route’s JSON and `Set-Cookie` flags was not added. |
| MF-03 — session verifier accepts missing/invalid expiry claims | Low | **Fixed and verified** | Verifier requires canonical HMAC signature, `HS256`/`JWT`, identity, integer `iat`/`exp`, expiry, bounded future `iat`, maximum 72-hour lifetime, valid role/tier. Signed malformed, expired, future-issued, and mismatched-algorithm fixtures are rejected; valid token passes. |
| MF-04 — Redis outage falls back to process-local rate limits | Medium | **Partially mitigated** | Production defaults to fail-closed; Redis rate-limit operations time out after 2 seconds; authentication limiter returns 503 on failure; tests cover policy, timeout, failure, and recovery behavior using controlled local mocks. An explicit `RATE_LIMIT_FAILURE_POLICY=local` override remains possible and weakens distributed guarantees; the inspector’s separate in-memory limiter is not distributed. Upstash behavior was not exercised. |
| Phase 1 subprocess output/cleanup resource candidate | Informational candidate (no separate numbered finding) | **Partially mitigated** | yt-dlp stdout/stderr retention is capped at 256 KiB each; metadata `execFile` output is capped at 2 MiB; FFmpeg/FFprobe subprocesses have output/time bounds; media is capped at 512 MiB per resulting file; active media subprocess count is capped at two; cancellation and shutdown send TERM then KILL to the process group; per-job directories are validated and newly created with mode 0700. Existing temp-root permissions are not changed. No end-to-end child-process fixture verified cleanup on every lifecycle branch; storage capacity and aggregate multipart/temp usage remain operator/runtime concerns. |

No Critical finding was confirmed in Phase 1. MF-01 remains the only original High finding and remains a release blocker.

## 3. Files changed

- `server/ytDlpService.ts` — production proxy requirement and arguments, bypass-variable clearing, stricter timeout, bounded output, process concurrency, file cap, contained private job directory, child process-group termination, shutdown support, bounded FFmpeg process execution.
- `server/ffmpeg.ts` — private new directories, job path checks, 512 MiB file limit, FFmpeg/FFprobe time and output limits.
- `server/auth.ts` — cookie-only session extraction, strict signed claim validation, same-origin mutation guard.
- `server.ts` — apply mutation guard, stop returning tokens, cookie-clear attributes, graceful child-process shutdown.
- `src/context/AppContext.tsx`, `src/views/AdminView.tsx`, `src/components/ActiveJobModal.tsx` — remove JavaScript bearer state/headers and clear legacy localStorage token.
- `server/redis.ts` — explicit fail-closed production policy and 2-second Redis operation timeout.
- `server/regressionTests.ts` — proxy, output cap, cookie-only session, signed claims, Redis timeout/failure/recovery, and CSRF regressions; existing bearer-based fixtures moved to cookie sessions.
- `.env.example` — documents required proxy and rate-limit policy variables using placeholders only.
- `SSRF_EGRESS_LIMITATIONS.md` — states that a proxy URL is not proof of network-level containment.

`server/operationalSecurity.ts` is not part of this remediation; its pre-existing one-line unstaged deletion is preserved.

## 4. Verification and before/after results

### Before

- Phase 1 baseline: `npm test` — 43 passed, 0 failed.
- Session bearer token was returned in JSON, stored in `localStorage`, and sent in `Authorization` headers.
- Token verifier did not require expiry/issued-at claims or check the JWT algorithm header.
- Redis rate-limit failures silently used process-local counters.
- yt-dlp subprocess made independent network requests without an application-enforced proxy.

### After

| Command/check | Result |
|---|---|
| `npm run lint` | Exit 0 (`tsc --noEmit`). |
| `npm test` | Exit 0; **47 passed, 0 failed**. |
| `npm run build` | Exit 0; Vite and server build completed. |
| `npm audit --omit=dev --json` | Exit 0; zero reported advisories. |
| `npm audit --json` | Exit 0; zero reported advisories. |
| `git diff --check` | Exit 0; no whitespace errors. |
| Targeted secret-pattern scan with `rg -l` | No high-specificity key/private-key pattern matches in the current searchable tree; this is not a substitute for history scanning. |
| Gitleaks, Semgrep, OSV-Scanner, Trivy, ZAP, CodeQL CLI | Unavailable on this Android ARM64 environment; no tools installed. |
| Production endpoint/service checks | Not performed in this phase; no external access/configuration authorization. |

The regression suite specifically verifies allowed/blocked proxy URL syntax, missing production proxy failure, process output cap, session claim validation, bearer rejection/cookie acceptance, cross-origin mutation rejection, Redis closed policy, mocked Redis timeout/failure/recovery, plus existing SSRF, job authorization, token/path, database TLS and storage-related tests. It does **not** make real outbound requests through an egress proxy or prove service-level egress restrictions.

## 5. Operator checklist — external configuration still required

### Render and outbound egress

1. **Set `YTDLP_PROXY_URL`** to the operator-managed HTTP(S) egress proxy endpoint. Do not include embedded username/password credentials; application validation rejects them. No actual endpoint is supplied by this report.
2. **Enforce network-level policy for every media subprocess.** The proxy/firewall must deny loopback, private, link-local, cloud metadata, multicast, reserved and IPv4-mapped destinations after DNS resolution; re-check every redirect and DNS resolution; prevent yt-dlp and any child process from reaching destinations directly around the proxy. The application’s `--proxy` option and cleared `NO_PROXY` values do not prove this.
3. **Keep Node’s guarded outbound traffic functional.** Node provider/API calls currently use the DNS-pinned transport and connect directly; scope the policy so necessary approved public provider/API traffic continues while internal destinations remain denied. Confirm whether Render supports the required per-service/per-process egress control. This audit did not inspect Render capabilities or settings.
4. **Verification:** in an authorized staging environment, exercise controlled local proxy fixtures that prove public requests succeed and prohibited destinations/redirects are denied; inspect Render egress policy and confirm direct process egress is blocked. Do not test production metadata/internal addresses. Confirm logs do not record proxy credentials or signed URLs.
5. **Impact:** missing or malformed proxy configuration causes production startup/media extraction to fail closed. An over-restrictive egress policy can break providers and downloads.
6. **Rollback:** revert to a previous reviewed application revision only if needed for service recovery, but do not restore unrestricted yt-dlp egress. Keep download functionality disabled or service unavailable until equivalent egress containment exists. A proxy endpoint change may require Render restart/redeploy; verify with the operator.

If Render cannot enforce the required boundary, use a controlled egress gateway or isolated media worker with enforced network policy. Until that is implemented and verified, keep release blocked.

### Redis / Upstash

- Keep `RATE_LIMIT_FAILURE_POLICY=closed` in production. Do not set `local` for a multi-instance production service; it restores per-process fallback behavior.
- Verify Upstash REST TLS/authentication, connectivity alarms and rate-limit key TTL behavior. No credentials were read and no service settings were changed.
- Failure mode: login/password-change/recovery throttles return 503 while Redis rate limiting is unavailable. Recovery is automatic when Redis checks succeed again. Verify this behavior against staging monitoring.
- Rollback: restore Redis connectivity/configuration; do not switch to `local` as an emergency production bypass without accepting the reduced protection and explicit approval. No application restart is required for policy changes only if the hosting environment reloads variables dynamically; otherwise redeploy/restart according to the owner’s procedure.

### Supabase, Neon, and GitHub

- **Supabase:** verify the configured media bucket is private; review Storage policies so application service-role access is server-side only; check upload/overwrite/delete permissions and object retention. Application code can create a private bucket when absent but this audit did not inspect an existing production bucket or policy. A policy change may affect media access; test with synthetic objects and record rollback SQL/dashboard settings. Restart is generally not required for policy-only changes.
- **Neon:** verify production role has least privileges and TLS certificate verification remains enabled. No database/dashboard changes are required by this source remediation; no connection was made.
- **GitHub:** no workflow or authorized CodeQL integration was found during Phase 1. If CI is used, enable least-privilege permissions and authorized secret/dependency scanning; no repository settings were changed.

## 6. Remaining risks

- **MF-01 is still open:** proxy enforcement, DNS/redirect policy, and prevention of direct subprocess egress are not verified. This is the release blocker.
- Cookie-only authentication intentionally stops accepting bearer Authorization sessions. Existing browser sessions with the HttpOnly `mf_session` cookie should continue until expiry; clients that only retained a localStorage bearer token must sign in again. No production session was invalidated or inspected.
- Same-origin middleware rejects cross-origin requests when an Origin header is present; requests without Origin remain allowed for non-browser clients. `SameSite=Lax` remains an additional control. End-to-end deployment/proxy behavior was not exercised.
- Redis policy can be explicitly overridden to `local`; the separate inspector limiter remains process-local. Verify production configuration is `closed` and assess centralizing that limiter.
- The 512 MiB limit applies per media file; aggregate temporary storage, platform disk quotas, orphan cleanup after forced termination, and full job queue admission remain unverified.
- Dedicated secret-history scanning, Semgrep/CodeQL analysis, real proxy integration tests, Supabase policy inspection, and production health/header checks remain outstanding.
- No dependency advisory was reported by npm audit. Lockfile consistency between npm and Bun was not checked.

## 7. Rollback considerations

No rollback was performed. Source rollback should use a reviewed inverse patch limited to the files listed above; do not restore whole files or touch the pre-existing `server/operationalSecurity.ts` modification. Preserve both security reports and ignored build outputs. Reverting the cookie-only change would reintroduce JavaScript-accessible bearer tokens; reverting the proxy requirement would restore the primary release blocker. Prefer leaving processing unavailable over removing egress controls.

## 8. Final status and approval boundary

**Release decision: BLOCK RELEASE.** Local code checks pass, but deployment readiness is unproven until the operator establishes and verifies the external network-egress boundary and production service configuration. No deployment is authorized by this remediation approval and none was attempted. Commit, push, publication, external settings changes, production secret changes, and deployment remain unapproved.
