# MediaForge / VideoFetch — Five-Phase Completion Report

**Date:** 2026-10-25 (UTC)
**Base and HEAD:** `75ac6a65e6365caefb0459f6a0791acf5b020b63`
**Branch:** `fix/seo-render-canonical-domain`
**Worktree:** `~/mediaforge-seo-domain-worktree`

## State and scope

The isolated worktree began at the specified base and had six unstaged SEO files. The original `~/mediaforge-git` checkout was not modified. This worktree now has those six unstaged files plus this new report. Nothing is staged, committed, pushed, merged, or deployed.

Source changes in the worktree:

- `index.html`: canonical, `og:url`, and JSON-LD site identity use `https://videofetch-docker.onrender.com`.
- `public/og-image.svg`: displayed hostname updated only.
- `public/robots.txt`: Sitemap directive uses the Render origin.
- `public/sitemap.xml`: all 32 URLs use the Render origin; the YouTube entry now points at the page’s canonical `/youtube-video-downloader` path.
- `server.ts`: dynamic sitemap origin uses the Render origin; its YouTube entry now uses `/youtube-video-downloader`.
- `src/components/SEOHead.tsx`: canonical origin uses the Render origin; path handling is unchanged.

`public/googleb03f64ed5e29ff18.html` is byte-for-byte identical to the base. The sitemap correction is supported by code: both `/youtube-downloader` and `/youtube-video-downloader` render the same view (`src/App.tsx:118-120`), while that view declares `/youtube-video-downloader` canonical (`src/views/SeoLandingViews.tsx:721-726`). The sitemap no longer advertises the alias.

## Phase 1 — SEO patch validation

**PASS:** Branch and HEAD match the expected isolated state; merge-base is the expected base. Only the six intended source files were modified before this report, and the staging area was empty.

**PASS:** `git diff --check` returned exit code 0. No `videofetch.app` references remain in the candidate worktree’s source. Base references in `index.html`, the SVG, robots, static sitemap, server route, and `SEOHead` were all domain-alignment targets.

**PASS:** Static sitemap has 32 `<loc>` entries, all on the Render origin. A read-only comparison found the dynamic sitemap’s 29 static routes plus 3 seeded blog posts match the same 32 static sitemap paths after the route correction. Robots and dynamic/static sitemap hostnames agree. The homepage canonical, `og:url`, and JSON-LD identities agree. The Search Console verification file is unchanged.

**PASS:** `npm ci --offline --no-audit --no-fund` in a fresh disposable copy returned exit code 0. npm reported that its install-script policy blocked two `esbuild` postinstall scripts; no package network access was permitted. `npm run lint` returned exit code 0. `npm test` returned exit code 0: **43 passed, 0 failed**. `npm run build` returned exit code 0 and generated `dist/` and `server-build/` only in that disposable copy. The copy was created under Termux’s writable temporary directory from the base archive plus the worktree diff; it excluded `.env*`, `.git`, `node_modules`, `dist`, and `server-build` before install. No application was started.

The original checkout has no recorded changes from these checks. No build was run in either repository checkout.

## Phase 2 — Public endpoints and Search Console

Read-only GETs were made to the five URLs listed in the task, with a 12-second timeout and up to three redirects. All returned HTTP 200, zero redirects, and the requested Render URL as final URL:

| Path | Content type | Observed response |
|---|---|---|
| `/` | `text/html; charset=UTF-8` | canonical and JSON-LD still use `https://videofetch.app`; no `og:url` was present in the observed HTML |
| `/robots.txt` | `text/plain; charset=UTF-8` | Sitemap directive still points to `https://videofetch.app/sitemap.xml` |
| `/sitemap.xml` | `application/xml; charset=utf-8` | XML root present; 32 URLs; all 32 use `videofetch.app`; none use the Render origin; advertises `/youtube-downloader`, not the page’s canonical path |
| `/ads.txt` | `text/plain; charset=utf-8` | Returns a placeholder `pub-XXXXXXXXXXXXXXXX` seller record, not an account-verified publisher ID |
| `/googleb03f64ed5e29ff18.html` | `text/html; charset=UTF-8` | Returns the expected verification marker; this does not prove Search Console property ownership or status |

A web search surfaced results for `videofetch.app`, but not a result for the Render hostname in the submitted query. Search results are not proof of indexing state. The Search Console/Windsor account tools are not connected here; property ownership, submitted sitemap status, coverage, and URL Inspection remain unverified.

Google says a sitemap submission is a hint and does not guarantee crawling or indexing: [Google Search Central — Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap). The next account-only step is to connect the authorized Search Console data source (Windsor.ai if that is the chosen connector), then inspect the verified property, sitemap processing, coverage, and URL Inspection results. Do not infer ownership from the public verification file alone.

## Phase 3 — SEO and publisher-readiness audit

### Findings

- **P1 — Live canonical and sitemap remain on the old host.** Confirmed by the public GETs above. The source patch is prepared but uncommitted and has not been deployed; this run made no production changes. Do not submit the new sitemap until the intended canonical host is the actual release host and the deployment is confirmed.
- **P1 — DMCA form does not match the server endpoint/schema.** `src/views/LegalViews.tsx:34-64` posts to `/api/dmca`, sends fields such as `claimantName`/`claimantEmail`, and fabricates a complaint ID and success acknowledgment on network failure. The inspected server exposes `/api/reports` with a different schema at `server.ts:1526-1571`, including required work/ownership descriptions and two affirmative declarations. This can falsely tell a rights holder a notice was filed. Not changed here: completing a legally meaningful form and preserving declarations needs a separately reviewed implementation.
- **P1 — Contact form success is simulated.** `src/views/AboutContactViews.tsx:168-181` sets success after a timer and never calls the existing `/api/contact` endpoint (`server.ts:1576-1596`). The page then claims the message was transmitted/routed (`AboutContactViews.tsx:239-245`). A visitor can believe a report reached the operator when it did not. Not changed in this SEO patch.
- **P1 — MF-01 is unresolved and some security copy overstates the boundary.** The About and privacy/security pages claim strict SSRF filtering (`AboutContactViews.tsx:130-136`, `LegalViews.tsx:536-543`, and the Security view around `LegalViews.tsx:602-604`). This checkout’s Node transport validates destinations, DNS answers, redirects, and pinned sockets (`server/outboundHttp.ts:145-203, 307-337`), but the yt-dlp child path is not confined by it; do not interpret the copy as proof of network isolation.
- **P2 — SPA route metadata is client-updated.** Production serves the same built `index.html` fallback for unknown paths (`server.ts:2263-2268`); per-route canonical metadata is set by `SEOHead` in a React effect (`src/components/SEOHead.tsx:59-76, 174`). The source’s per-route metadata is present, but initial HTML for deep links can retain homepage metadata until JavaScript runs. A server-rendering or pre-rendering design would be a separate enhancement; no runtime crawl render was tested.
- **P2 — Status page includes unsubstantiated service levels.** `src/views/StatusChangelogViews.tsx:47-56` hardcodes operational states, latency values, and uptime percentages. The code does not establish those as measured service history; replace only after authoritative monitoring evidence is available.
- **P2 — Claims need operator evidence and legal review.** Privacy/retention claims include “zero-persistence” and deletion within 15 minutes (`src/views/LegalViews.tsx:529-532`); the app also persists user/contact/DMCA data in its database code. Privacy language about accounts and provider data flow (`LegalViews.tsx:439-462, 522-550`) needs review against actual logs, retention, and account behavior. Do not infer legal compliance from the presence of policy pages.
- **P2 — Publisher content and ad readiness need work.** Platform pages share a generic template with repetitive claims (`src/views/SeoLandingViews.tsx:617-734`); page-specific originality and accuracy need a human content review. Ad units are conditionally rendered only when an AdSense client ID exists (`src/components/ads/AdContainer.tsx:47, 88-96`), and the HTML loader is likewise conditional (`src/components/ads/AdSenseScript.tsx:13-33`). The source and live `ads.txt` contain a placeholder publisher ID, so there is no verified seller record. Current AdSense requirements state that content should be original/high quality and the applicant 18 or older; site code access/ownership is also required. See [eligibility](https://support.google.com/adsense/answer/9724), [site ownership](https://support.google.com/adsense/answer/91205), and [age requirement](https://support.google.com/adsense/answer/14230). If the applicant is under 18, a parent/guardian must apply with their own Google Account; payments go to that adult.
- **P2 — Ad separation needs visual review.** `AdContainer` uses an “Advertisement” label (`src/components/ads/AdContainer.tsx:98-109`), but static code review cannot establish that mobile layouts keep ads distinct from download/navigation controls. Google prohibits placements that users could mistake for navigation or download links: [AdSense program policies](https://support.google.com/adsense/answer/48182) and [ad placement policies](https://support.google.com/adsense/answer/1346295). No mobile visual inspection was performed.

The live `ads.txt` is accessible but contains a placeholder. Google requires the actual publisher ID copied from the authorized account; no ID was invented. See [Google’s ads.txt guide](https://support.google.com/adsense/answer/12171612). AdSense account approval and site status remain unknown.

## Phase 4 — MF-01 egress security

**Status: OPEN — BLOCK RELEASE.** This worktree is based on the specified commit and does not contain `YTDLP_PROXY_URL` or an explicit yt-dlp proxy argument in the reviewed source. This differs from the task’s description of a proxy-configured app; the original dirty checkout and deployed artifact were intentionally not inspected. Therefore this report makes no claim about their exact proxy configuration.

In this worktree, `server/ytDlpService.ts:845-881` validates the initial metadata URL and passes it to `execFileAsync`; download flow validates the initial source, uses `--no-playlist`, and calls `spawn` without an explicit environment or proxy argument (`server/ytDlpService.ts:1095-1098, 1170-1203`). Initial URL validation does not pin child-process sockets or validate every extractor/API/redirect/fragment/CDN destination. Clearing `NO_PROXY` or setting a proxy variable would not itself prevent direct network connections. FFmpeg’s direct-media path first uses `fetchAndValidateMediaStream`, then gives FFmpeg a local file (`server/ffmpeg.ts:447-526`); yt-dlp still makes its own outbound requests. Fixed provider/API and Node media requests use `requestSafeHttp` (`server/providers.ts:5-17, 62-113`, `server/socialDownload.ts:62-113`), whose address pinning does not constrain yt-dlp.

The local regression suite includes unit/local-HTTP checks for private-address rejection and pinned Node redirects, but no infrastructure-level direct-egress denial test was run. Required closure evidence remains: an isolated worker context with default-deny IPv4 and IPv6 egress; the only allowed route to a filtering gateway; gateway DNS resolution and IP/port policy; controlled tests for direct TCP/UDP/QUIC, redirects, mixed DNS/rebinding, prohibited destinations, extractor/CDN traffic, proxy outage and fail-closed behavior; and evidence that the deployed worker policy matches the tested configuration. No production or unauthorized hosts were probed.

## Phase 5 — Monetization readiness

| Area | Status | Evidence / next step |
|---|---|---|
| Source-level AdSense integration | **NEEDS WORK** | Conditional client ID integration exists, but no actual account values or visual/mobile policy review were performed. Keep disabled until approved and verified. |
| Original, useful content | **NEEDS WORK** | Shared page template and claims require page-by-page originality/factual review; no quality decision or approval is inferred. |
| Domain ownership and AdSense approval | **ACCOUNT ACTION REQUIRED** | No authenticated AdSense account or ownership result available. |
| `ads.txt` | **BLOCKED** | Public endpoint returns a placeholder publisher ID; replace only from the authorized account after approval. |
| Privacy/legal/copyright claims | **NEEDS WORK** | DMCA/contact behavior and data-retention/security claims have confirmed or unverified gaps listed above. |
| MF-01 | **BLOCKED** | No network-level egress enforcement evidence. |

No AdSense script, publisher ID, seller record, or consent configuration was added. Google approval and revenue are not guaranteed by code readiness.

## Checks, limitations, and remaining actions

- Local repository checks: `git diff --check` PASS; no source test was run in the worktree itself.
- Disposable copy checks: offline `npm ci` PASS (exit 0; install-script warning noted), `npm run lint` PASS (exit 0), `npm test` PASS (43/43), `npm run build` PASS (exit 0).
- Public GETs: all five requested endpoints PASS for reachability (HTTP 200, no redirects). Their content still reflects the old host and placeholder `ads.txt` as reported above.
- Search Console state, AdSense account/age/approval, exact production source revision, mobile rendering, and infrastructure egress policy remain unverified.
- The only actions that require an authorized operator are: connect/read the actual Search Console and AdSense accounts; provide an approved publisher record if applicable; review legal and truthful operational claims; and later authorize any release. MF-01 additionally requires infrastructure-level staging capability and evidence, not just an application setting.

**Release gate:** `MF-01 OPEN — BLOCK RELEASE`. No performance improvement, production fix, Search Console ownership, indexing, AdSense approval, or production readiness is claimed.
