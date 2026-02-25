# Documentation Project

## Hosting & URLs

- Docs site is hosted on **Cloudflare Pages** with a **Cloudflare Worker** reverse proxy
- Worker (`worker/`) proxies `www.marketdata.app/docs/*` → `marketdata-docs.pages.dev`
- Staging: `www-staging.marketdata.app/docs/*` → `marketdata-docs-staging.pages.dev`
- CI/CD: GitHub Actions (`.github/workflows/deploy-docs.yml`) builds Docusaurus, restructures output to match URL paths, and deploys to Cloudflare Pages + Worker via Wrangler
- Build output is restructured in CI to nest under `docs/` so static files serve from correct paths without rewrite rules
- Edge caching enabled on Worker subrequests; `_headers` file generated in CI for asset cache control

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
