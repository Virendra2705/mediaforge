# MF-01 Production Egress Verification

**Date:** 2026-10-19  
**Repository:** `/data/data/com.termux/files/home/mediaforge-git`  
**Branch / HEAD:** `main` / `c51b87a` (`Polish VideoFetch UI and workflow animations`)  
**Finding:** MF-01 — yt-dlp subprocess egress bypasses pinned SSRF transport  
**Original severity:** High (Phase 1 report also prioritized it as P0 before release)  
**Verification decision:** **BLOCK RELEASE — MF-01 remains open.**

This is a read-only source and report review. No production URL, Render dashboard, proxy endpoint, internal address, metadata endpoint, or third-party system was contacted. No source, configuration, or existing report was changed. This report does not establish production deployment state.

## Repository state

- `pwd` and `git rev-parse --show-toplevel`: `/data/data/com.termux/files/home/mediaforge-git`.
- Branch and HEAD: `main`, `c51b87a`.
- No staged changes were present. Before this report, `git status --short` showed modified `.env.example`, `SSRF_EGRESS_LIMITATIONS.md`, `server.ts`, `server/auth.ts`, `server/ffmpeg.ts`, `server/operationalSecurity.ts`, `server/redis.ts`, `server/regressionTests.ts`, `server/ytDlpService.ts`, `src/components/ActiveJobModal.tsx`, `src/context/AppContext.tsx`, `src/views/AdminView.tsx`, and untracked `security-reports/` containing the two existing reports. These changes were preserved.
- `git diff --stat` before this report: 12 tracked files, 320 insertions and 96 deletions. `git diff --cached --stat` was empty.
- The existing reports were untracked and preserved: `security-reports/production-security-audit-2026-10-19.md` and `security-reports/production-security-remediation-2026-10-19.md`.
- The requested report path did not exist before creation. No other file was written.

## Reports and source inspected

Read the Phase 1 audit and Phase 2 remediation report, including MF-01 evidence, prior test claims, deployment limitations, and operator guidance. Inspected current source and configuration at:

- `server/ytDlpService.ts` — proxy URL validation, executable detection, metadata extraction, fallback, download arguments, environment, process limits.
- `server/ffmpeg.ts` — alternate yt-dlp provisioning helper, media execution caller, FFmpeg and FFprobe paths.
- `server/security.ts` — asynchronous initial URL DNS validation.
- `server/outboundHttp.ts` — Node HTTP destination validation, DNS pinning, redirect handling and transport.
- `server/socialDownload.ts` — metadata fallback caller.
- `server/mediaEgressRoutes.ts` — public proxy and inspector routes using safe Node transport.
- `server/regressionTests.ts` — proxy configuration and offline SSRF regression evidence.
- `Dockerfile`, `.env.example`, `SSRF_EGRESS_LIMITATIONS.md`; searched tracked paths for Render, CI, and deployment YAML configuration.

No `.env` file or runtime environment values were read. `Dockerfile` is the only discovered deployment-oriented configuration among the searched files; no Render service manifest, egress rule, firewall policy, proxy source/configuration, or proxy operator document is present in the repository.

## Verified code-level controls

1. **Proxy setting is syntactically checked and required for production yt-dlp detection.** `getYtDlpNetworkArgs` at `server/ytDlpService.ts:48-60` requires `YTDLP_PROXY_URL` when `NODE_ENV` is `production`, accepts only HTTP(S), rejects embedded username/password, nonstandard ports, a non-root path, query, and fragment, and returns `--proxy <URL>`. `detectYtDlp` calls this validator at `server/ytDlpService.ts:186-193`. This proves validation and argument construction in this source revision, not that a real endpoint exists, is reachable, or enforces destination policy.

2. **Both main yt-dlp network entrypoints include the configured proxy option.** Metadata uses `getYtDlpNetworkArgs()` in `server/ytDlpService.ts:909-937`; the download invocation uses it in `server/ytDlpService.ts:1226-1265`. These are respectively `execFile` and `spawn` argument arrays, not shell command strings. Production `YTDLP_PATH` must be pre-provisioned (`server/ytDlpService.ts:192-205`), which prevents the automatic development fallback from being used by production detection.

3. **Proxy bypass environment variables are cleared for these two invocations.** Their subprocess environments spread the parent environment but set `NO_PROXY` and `no_proxy` to empty strings (`server/ytDlpService.ts:933-937, 1262-1265`). This does not prove that all yt-dlp extractor transports, helper runtimes, protocols, or child processes honor the CLI proxy or cannot open another socket. Other inherited environment variables are not comprehensively removed.

4. **Initial user URL validation rejects nonpublic DNS answers before invoking yt-dlp.** Both entrypoints call `validateAndNormalizeUrlAsync` (`server/ytDlpService.ts:893-901, 1143-1151`). It resolves all answers and rejects a non-global answer (`server/security.ts:86-120`). The resulting addresses are not passed to yt-dlp or pinned for its sockets. DNS can change after this check; extractor URLs, redirect targets, fragment URLs, and CDN hosts are discovered later inside yt-dlp and do not pass through this check.

5. **Some subprocess/resource controls exist.** Downloads disable playlists and cache, limit retries, set socket timeout and file-size cap, use an output template under a checked job directory, and apply an overall timeout and two-process cap (`server/ytDlpService.ts:1156-1168, 1226-1283`). Captured output is capped (`server/ytDlpService.ts:1269-1274`). These reduce resource exposure but do not constrain network destinations. `--no-playlist` does not disable redirects, format fragments, or extractor-derived secondary requests.

6. **Node-managed HTTP requests use a distinct guarded transport.** `server/outboundHttp.ts:145-166` validates schemes, ports, hostnames, and literal addresses; `:183-203` checks all DNS records and selects an address; `:205-269` connects using the selected address; `:307-337` revalidates redirect destinations at each hop. This applies to callers using `requestSafeHttp`, including the proxy/inspector endpoints in `server/mediaEgressRoutes.ts:16-30, 59-87` and the safe binary-download helper in `server/ffmpeg.ts:48-56`. It does not transparently govern yt-dlp’s own networking.

7. **Other yt-dlp paths found.** `server/socialDownload.ts:274-280, 345-348` falls back to `ytDlpService.getMetadata`, so it uses the metadata path above. `server/ffmpeg.ts:28-80` contains a legacy helper that can download a yt-dlp binary using `requestSafeHttp`; repository search found only its definition and no caller. The active media path calls `ytDlpService.executeDownload` (`server/ffmpeg.ts:548-558`). RapidAPI metadata fallback uses Node-side provider code, not another yt-dlp invocation. The `--version` checks do not request media. The development-only automatic `curl` provisioning fallback in `server/ytDlpService.ts:387-408` is not selected after production detection requires an explicit `YTDLP_PATH`.

## Proxy implementation and configuration findings

The repository specifies **no proxy implementation**. The only contract is an operator-supplied `YTDLP_PROXY_URL` interpreted as an HTTP(S) URL and passed to yt-dlp with `--proxy`. `.env.example` contains an example placeholder only; it is not evidence of a production value. No proxy software, version, policy, DNS resolver, redirect policy, ACL, authentication arrangement, or operator ownership is defined here. The URL validator’s rejection of embedded credentials also means this code provides no evidence for proxy authentication credentials or an alternative authentication mechanism.

`Dockerfile:1-34` builds and runs the app container as an unprivileged `node` user and declares `NODE_ENV=production` and `YTDLP_PATH`. It contains no proxy endpoint and no network policy. There is no repository evidence that Render blocks direct Internet egress from the app container, Node, yt-dlp, or child processes. Container user identity and a proxy argument do not impose an egress boundary.

## Controls that remain unverified

| Control needed to close MF-01 | Status and reason |
|---|---|
| Production `YTDLP_PROXY_URL` is configured and points to the intended operator-managed proxy | **Unverified.** Runtime settings and deployed revision were not available. No value was read. |
| Every yt-dlp networking mode and secondary request uses the proxy | **Unverified.** Source passes the global `--proxy` option to metadata and download calls, but there is no runtime integration trace proving all extractors, redirects, fragments, JavaScript challenge helpers, or any spawned helpers cannot open direct connections. |
| Proxy resolves hostnames safely and rejects prohibited DNS answers at connection time | **Unverified.** No proxy implementation or policy is present. |
| Proxy checks every redirect and re-resolution, including DNS rebinding | **Unverified.** The app-level Node redirect protections do not apply to yt-dlp or to a proxy unless the proxy itself implements them. |
| Proxy rejects loopback, RFC1918, link-local, unspecified, multicast, reserved, shared-use, metadata, IPv4-mapped IPv6, IPv6 special/transition ranges, and alternate numeric/address representations | **Unverified.** No implementation or authorized controlled test evidence was supplied. A generic proxy URL does not prove destination filtering. |
| Proxy blocks non-HTTP(S) protocols and disallowed ports where applicable | **Unverified.** No proxy policy or subprocess integration evidence is available. |
| Render prevents direct outbound connections from the service and child processes when proxy use is mandatory | **Unverified.** No Render dashboard or provider network-policy evidence was inspected; no repository egress policy exists. |
| Required Node public provider/API traffic remains available under the policy while prohibited destinations stay blocked | **Unverified in deployment.** Node source has its own guarded transport, but production routing and firewall interactions were not exercised. |
| Production logs and observability do not expose proxy credentials or sensitive proxy configuration | **Not dynamically verified.** No production logs or real endpoint were accessed. This report contains no runtime values. |

The Phase 2 report independently records MF-01 as “Partially mitigated; still open” and states that no proxy was exercised and Render egress restrictions were not inspected. Its local regression checks verify URL syntax/missing configuration and output bounds, not network enforcement. A successful ordinary download or these unit tests would not satisfy the missing controls.

## Safe operator steps to obtain evidence

Perform these steps only with service/proxy owner authorization. Do not send secret values or production signed URLs in evidence artifacts.

1. **Confirm deployed app settings.** In the authorized Render service configuration, verify the deployed commit and that `NODE_ENV=production`, `YTDLP_PATH` points to the provisioned binary, and `YTDLP_PROXY_URL` is set. Record the setting names, service/revision, and a redacted endpoint identity (for example hostname only); never export or paste secrets. Check deploy logs for configuration success/failure without collecting credentials.

2. **Identify the actual proxy.** Obtain the proxy product/implementation and version, operator, network location, supported protocols, resolver behavior, and the effective destination/port policy. Review the effective config or provider documentation with the proxy owner. Require the policy to canonicalize URLs and IP representations before filtering, check every A/AAAA result on each connection, fail closed on mixed/invalid results, and recheck every redirect and DNS re-resolution. Ensure blocked ranges include IPv4/IPv6 loopback, private, link-local, unspecified, multicast, reserved and shared-use ranges; cloud metadata and provider-specific internal ranges; IPv4-mapped IPv6 and relevant IPv6 transition/tunneling ranges; and noncanonical/alternate numeric IP forms. Do not treat a range list alone as proof that the implementation enforces it.

3. **Establish the Render network boundary.** Obtain current Render documentation or written provider/operator confirmation for the service’s outbound filtering capabilities and inspect the actual configured policy. Show that direct outbound connections from the app container and its child processes cannot bypass the required proxy. If Render cannot enforce this, document an alternative controlled egress gateway or isolated media worker with a network policy that permits only required egress. Preserve the Node service’s necessary public API access while blocking prohibited destinations. Do not change settings as part of this verification.

4. **Run controlled staging tests on owned fixtures.** In a staging service with the same network policy and proxy implementation, make a benign yt-dlp request to an operator-owned public test origin and confirm expected success through proxy logs. Have the operator-controlled proxy test endpoints or synthetic DNS fixtures return/redirect only to owned test sinks representing blocked classes; confirm the proxy rejects the request before a connection reaches the sink. Cover IPv4 and IPv6, mapped/alternate representations, mixed public/prohibited DNS responses, a controlled redirect to a blocked sink, and DNS answer changes between lookup and connection. Do not target real internal services or cloud metadata addresses. Test a controlled direct-egress attempt from the same service/child-process context and confirm a network-level deny event; a successful proxied request alone is insufficient.

5. **Capture reproducible evidence.** Retain redacted policy/config excerpts, provider capability documentation or written confirmation, staging test commands and results, proxy deny logs, network deny logs, service/revision identifiers, and timestamps. Ensure evidence does not include credentials, cookies, bearer tokens, or signed media URLs. Have the proxy and Render/network operators attest which production service and policy the evidence covers.

6. **Compare staging and production configuration.** Before considering closure, verify via authorized inspection that production uses the same reviewed policy and proxy version/configuration as staging, with the correct service and process coverage. Do not infer this from matching environment variable names.

## Objective MF-01 closure and release criteria

MF-01 can be marked **Fixed and verified** only when all criteria below have evidence tied to the intended production deployment and its effective network boundary:

1. The deployed revision contains the reviewed proxy-required code, and the production service has the intended proxy configured without disclosing its value.
2. An authorized controlled staging integration demonstrates that metadata extraction, download, redirect, and media fragment/segment requests use the proxy; logs or network observations show no alternate direct request path.
3. The exact Render/service network policy demonstrably blocks direct outbound attempts from the application and subprocess context when the proxy is mandatory. At least one harmless owned-destination test produces an explicit network-level deny result for a direct attempt while an allowed request through the proxy succeeds.
4. The proxy’s effective configuration and controlled tests establish rejection of prohibited IPv4 and IPv6 destination categories, alternate address representations, mixed DNS answers, DNS rebinding/change, and redirect-to-prohibited-sink cases. The proxy must check resolved destinations at connection time and apply the same control on every redirect/hop; no production internal destination is contacted.
5. The authorized production configuration is shown to match the reviewed staging policy/version and service scope. Required Node public API routes remain functional under the policy, and logs do not expose credentials or sensitive URLs.
6. Evidence is reviewed by the service and proxy/network operators and recorded without secrets. Any uncovered protocol, extractor, child process, address family, redirect, or egress route leaves MF-01 open.

If these conditions cannot be enforced on Render for the current service, keep release blocked and move yt-dlp work to a separately controlled egress gateway/worker before release. Application-side `--proxy`, empty `NO_PROXY`, initial URL validation, a normal download, or passing local unit tests alone are not closure evidence.

## Final decision

**BLOCK RELEASE.** The repository proves that the current source requires a proxy URL in production and passes it to both yt-dlp entrypoints. It does not identify or verify the proxy, its destination filtering, per-hop DNS/redirect behavior, or a Render network rule preventing subprocess direct egress. No authorized staging or production network test was run. Until the operator evidence and objective criteria above are satisfied, MF-01 remains a release blocker.
