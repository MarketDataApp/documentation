# Documentation Project

## Hosting & URLs

- Docs site is hosted on **Cloudflare Pages** with a **Cloudflare Worker** reverse proxy
- Both environments use the same `/docs/` base path — routing is by hostname, not path prefix

| Environment | URL                                | Pages Project                | Branch    |
|-------------|------------------------------------|------------------------------|-----------|
| Production  | `www.marketdata.app/docs/`         | `www-marketdata-app`         | `main`    |
| Staging     | `www-staging.marketdata.app/docs/` | `www-staging-marketdata-app` | `staging` |

## Architecture

### Request flow

1. DNS resolves the hostname (both are proxied CNAMEs in Cloudflare)
2. Cloudflare routes `/docs` and `/docs/*` to the Worker (via `wrangler.toml` route patterns)
3. Worker (`worker/handler.js`) looks up the hostname in the `TARGETS` map to find the Pages target
4. Worker rewrites the hostname and fetches from the Pages project (e.g. `www-marketdata-app.pages.dev/docs/api/stocks`)
5. Pages serves the file from its `docs/` directory (built and nested there by CI)
6. Worker returns the response to the client — path stays the same throughout

### Worker features

**The worker lives in `MarketData-App/www-marketdata-app`, not here, and it is
being retired** (MarketData-App/www-marketdata-app#15). Nothing in this repo
deploys it. What it still does:

- **Hostname-based routing**: `TARGETS` map in `handler.js` maps each hostname to its Cloudflare Pages deployment
- **Markdown serving**: rewrites `Accept: text/markdown` to the twin's path and proxies it. It does NOT fetch source from GitHub — it stopped on 2026-08-25, for reasons recorded in `handler.js`
- **SDK PHP redirect**: `/docs/sdk-php/*` → `marketdataapp.github.io/sdk-php/*` (301), with a doubled-directory collapse
- **cdn-cgi rescue**: `/docs/**/cdn-cgi/**` → `/cdn-cgi/**` (302)
- **Edge caching**: Passes `cf.cacheEverything` on subrequests
- **404 logging**: Logs pathname and referer for 404 responses

What has already moved off it, and needs nothing at the edge:

| Behaviour                           | Now served by                                                     |
|-------------------------------------|-------------------------------------------------------------------|
| `Accept: text/markdown` negotiation | a Cloudflare Transform Rule, live on both hostnames               |
| the legacy `/docs/sdk-php/*` space  | `_redirects`, generated from `SDK_PHP` in `redirects.js`          |
| `/docs/robots.txt` returning 404    | nothing — the build writes no `robots.txt`, so it 404s on its own |
| 404 logging                         | Cloudflare zone analytics, which exposes referer on this plan     |

One behaviour dies with the worker and is **accepted, not replaced**: the
canonical `Link` header on Markdown responses. See
MarketData-App/www-marketdata-app#16. Pages types `.md` correctly without help,
so only the header is lost.

### CI/CD pipeline

**Docs repo** (`.github/workflows/deploy-docs.yml`):

1. Builds Docusaurus (`yarn build`)
2. Restructures build output to nest under `build/docs/`
3. Generates `_headers` file for asset cache control
4. Uploads build to R2 (`www-marketdata-app-builds` bucket) at `{env}/sources/docs/`
5. Triggers orchestrator via `repository_dispatch`
6. If `worker/` files changed: runs worker tests, then deploys the worker

**Orchestrator** (`MarketDataApp/www-marketdata-app`, `.github/workflows/deploy-site.yml`):

1. Downloads all sources from R2 (`{env}/sources/`)
2. Merges into unified `build/` directory
3. Deploys to Cloudflare Pages (`www-marketdata-app` or `www-staging-marketdata-app`)
4. Notifies source repo via `deploy-complete` dispatch

**Post-deploy tests** (`.github/workflows/post-deploy-tests.yml`):

1. Triggered by `deploy-complete` from the orchestrator
2. Checks out the docs repo at the deployed commit SHA
3. Runs integration tests and e2e tests against the deployed environment

### DNS

- `www-staging.marketdata.app` → CNAME to `www-staging-marketdata-app.pages.dev` (proxied)
- `www.marketdata.app` → existing DNS (proxied)

## Workflow

- Work on the **staging** branch, verify changes at `www-staging.marketdata.app/docs/`
- Once verified, open a PR from `staging` → `main` and merge to deploy to production

## Package Manager

- Use **yarn**, not npm (project uses `yarn.lock`)

## Search

- Algolia DocSearch (App ID: IUHZFO750H, Index: "Market Data Documentation")
- Crawler config is managed in the Algolia dashboard, not in the codebase
- `hierarchy.lvl1` is ranked above `hierarchy.lvl0` in searchable attributes (custom tweak from Docusaurus default)

## Sidebar Badges

- Badges (New, Premium, Beta, High Usage) are configured via `sidebar_custom_props: { badge: n/p/b/h }` in page frontmatter
- Rendered by `src/theme/RenderTag.js`, styled in `src/css/custom.css`
- Supported in sidebar links, sidebar categories, and page titles via swizzled theme components

## Sitemap

The sitemap is generated by `@docusaurus/plugin-sitemap`, which **skips it
entirely when `noIndex` is set** — so only production publishes one, and
`www-staging.marketdata.app/docs/sitemap.xml` correctly 404s.

Three checks guard it, each covering a link the others cannot see. #188 needed
all three: the sitemap was correct, the build was correct, and the pages were
deleted from R2 after the build by `aws s3 sync --delete`.

| Check                               | Where             | Catches                                                       |
|-------------------------------------|-------------------|---------------------------------------------------------------|
| `scripts/lint-sitemap.js`           | PR checks         | the sitemap lists a route that did not build                  |
| "Upload to R2" verification         | `deploy-docs.yml` | a built file did not reach R2                                 |
| `tests/sitemap.integration.test.js` | post-deploy       | the deployed site does not serve a URL the sitemap advertises |

**Never use `aws s3 sync --delete` against the R2 build bucket.** It queues a
delete and an upload for the same key and races them; see the comment above the
"Upload to R2" step for the measurements.

### Cache-warm vs cache-busted probes

**When a page count matters, cache-bust.** A plain request is served from the
Cloudflare edge, so it can return 200 for a page that is no longer in the
deployment — for as long as the cache entry lives, which was over two days
during #188.

| Probe        | Request                          | Answers                                |
|--------------|----------------------------------|----------------------------------------|
| Cache-warm   | `curl <url>`                     | what a visitor is served **right now** |
| Cache-busted | `curl "<url>?cb=$RANDOM$RANDOM"` | what the **deployment** contains       |

Cloudflare puts the query string in the cache key, so a unique value forces a
miss and a fetch from the origin.

> A cache-warm probe measures delivery, a cache-busted probe measures the
> deployment, and only the second one can tell you what a fresh visitor will get
> tomorrow.

Run both and compare. **A disagreement is a delayed failure, already queued** —
the page looks correct today and starts 404ing when the cache expires, with no
new deploy and no new cause.

Three numbers in #188 were wrong for want of this: the original count of 15, a
later count of 16, and the production 404 traffic figure. That last one is
edge-side, so a dead URL served 200 from a warm cache never enters the 404
report at all — those counts are a floor, not a total, and the flaw is
self-concealing, because anyone testing the tooling against a known-dead URL
sees 200s and concludes it works.

`tests/sitemap.integration.test.js` is deliberately cache-warm: it is the only
check that reads what the public reads. A green run there proves delivery, not
completeness.

## Markdown Twins

`plugins/markdown-twins.js` writes a Markdown copy of **every** built route into
the build, under three names that hold identical bytes:

```
api/stocks/candles.md             what a person or an agent guesses
api/stocks/candles/index.md       what sits beside index.html
api/stocks/candles/index.html.md  the llmstxt.org v2 spelling
```

Two converters feed it, and they do not overlap:

| Source                                            | Converter                         | Routes |
|---------------------------------------------------|-----------------------------------|--------|
| a `.md`/`.mdx` file resolved through `CANDIDATES` | `lib/mdx-to-md.js` (`cleanMdx`)   | 261    |
| the built HTML, when no source file exists        | `lib/html-to-md.js` (`cleanHtml`) | 10     |

`cleanMdx` is the converter for our MDX and stays that way — **do not put
`cleanHtml` on a route that has a source.** `cleanHtml` exists only for routes
that have no source for *any* converter to read: the docs root
(`src/pages/index.tsx`), the 404, the Algolia search UI, and the seven generated
tag pages.

**Every built route must have a twin, and `postBuild` fails the build if one
does not.** It cannot be a warning. The worker answers `Accept: text/markdown`
today and *falls through* to the HTML proxy for a twin-less route, so the gap is
invisible from outside — `/docs/` returned HTML rather than 404. Its
replacement, a Cloudflare Transform Rule that rewrites `<route>` to
`<route>index.md` (MarketData-App/www-marketdata-app#15), is unconditional and
cannot fall through, so a route with no twin becomes a 404 on the day the worker
is switched off, with no deploy and no other cause.

Two routes get a name set that is not `<stem>` three ways:

- **the docs root** gets `index.md` and `index.html.md` only — its alias name
  would be `.md`
- **the 404** gets `404.md`, `404/index.md` and `404.html.md`, matching
  `NOT_FOUND_TWINS` in `MarketDataApp/website`'s `src/lib/markdown-twins.mjs`,
  because it is a file rather than a directory route

`lib/html-to-md.js` mirrors the Turndown configuration in
`MarketDataApp/website`'s `src/integrations/markdown-versions.mjs`, so the two
halves of the origin answer in one Markdown dialect. That repo is private with
no `exports`, so it is vendored rather than imported.

## Testing

- **Unit tests**: `cd worker && yarn test` — tests worker routing, markdown serving, robots.txt, 404 logging
- **Converter tests**: `yarn test:lib` — `cleanMdx` (MDX→Markdown) and `cleanHtml` (built HTML→Markdown), the two twin converters
- **Redirect tests**: `TEST_ENV=staging yarn test:redirects` — verifies every rule in `redirects.js` answers 301 for GET and HEAD, in both slash forms
- **Sitemap tests**: `TEST_ENV=production yarn test:sitemap` — fetches the deployed sitemap and requires every URL to answer 200. On staging it asserts the opposite: a `noIndex` build must publish no sitemap
- **Sitemap lint**: `yarn lint:sitemap` — builds with `PROD=true` and fails if the sitemap lists a URL with no page in `build/`
- **E2E tests**: `TEST_ENV=staging yarn test:e2e` — Playwright tests for Context7 widget rendering
- **Browser for e2e**: the machine's own Chromium, not a build this repo pins. `scripts/resolve-chromium.js` resolves it (`CHROMIUM_PATH` override → system browser → Playwright's bundled build) and `playwright.config.js` feeds it to `launchOptions`. Do not reintroduce a bare `browserName: 'chromium'` with no `executablePath` — that re-pins the browser to the installed `@playwright/test`. CI installs Playwright's build only when the runner has no browser. See README.md "Which browser the e2e tests run".
