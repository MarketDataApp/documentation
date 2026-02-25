# Documentation Project

## Hosting & URLs

- Docs site is hosted on **Cloudflare Pages** with a **Cloudflare Worker** reverse proxy
- Both environments use the same `/docs/` base path — routing is by hostname, not path prefix

| Environment | URL | Pages Project | Branch |
|-------------|-----|---------------|--------|
| Production | `www.marketdata.app/docs/` | `www-marketdata-app` | `main` |
| Staging | `www-staging.marketdata.app/docs/` | `www-staging-marketdata-app` | `staging` |

## Architecture

### Request flow

1. DNS resolves the hostname (both are proxied CNAMEs in Cloudflare)
2. Cloudflare routes `/docs` and `/docs/*` to the Worker (via `wrangler.toml` route patterns)
3. Worker (`worker/handler.js`) looks up the hostname in the `TARGETS` map to find the Pages target
4. Worker rewrites the hostname and fetches from the Pages project (e.g. `www-marketdata-app.pages.dev/docs/api/stocks`)
5. Pages serves the file from its `docs/` directory (built and nested there by CI)
6. Worker returns the response to the client — path stays the same throughout

### Worker features (`worker/`)

- **Hostname-based routing**: `TARGETS` map in `handler.js` maps each hostname to its Cloudflare Pages deployment
- **Markdown serving**: Requests with `.md` extension or `Accept: text/markdown` header fetch raw source from GitHub and return cleaned markdown (frontmatter stripped, JSX components converted)
- **SDK PHP redirect**: `/docs/sdk-php/*` → `marketdataapp.github.io/sdk-php/*` (301)
- **robots.txt blocking**: Returns 404 for `/docs/robots.txt` to prevent stale cached copies
- **Edge caching**: Passes `cf.cacheEverything` on subrequests
- **404 logging**: Logs pathname and referer for 404 responses
- Non-docs paths pass through to the origin (WordPress)

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
4. Runs post-deploy integration and e2e tests

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

## Testing

- **Unit tests**: `cd worker && yarn test` — tests worker routing, markdown serving, robots.txt, 404 logging
- **Integration tests**: `cd worker && TEST_ENV=staging yarn test:integration` — fetches live sitemap and verifies markdown serving for every doc URL
- **Redirect tests**: `cd worker && TEST_ENV=staging yarn test:integration` — verifies client-side redirects from `docusaurus.config.js`
- **E2E tests**: `TEST_ENV=staging yarn test:e2e` — Playwright tests for Context7 widget rendering
