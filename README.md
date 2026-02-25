# Market Data Documentation

The official documentation for [Market Data](https://www.marketdata.app/) — covering the REST API, SDKs, and Google Sheets Add-On. Built with [Docusaurus 3](https://docusaurus.io/).

**Production:** [www.marketdata.app/docs/](https://www.marketdata.app/docs/)
**Staging:** [www-staging.marketdata.app/docs/](https://www-staging.marketdata.app/docs/)

## Documentation Sections

| Section | Path | Description |
|---------|------|-------------|
| **API** | `/api` | REST API reference — stocks, options, indices, funds, markets, and utilities |
| **SDKs** | `/sdk` | Client libraries for Go, Python, and PHP |
| **Sheets Add-On** | `/sheets` | Google Sheets Add-On documentation |
| **Accounts & Billing** | `/account` | Account management, plans, billing, and entitlements |

## Local Development

```bash
yarn          # Install dependencies
yarn start    # Start dev server at localhost:3000
yarn build    # Production build
```

## Architecture

The site is hosted on **Cloudflare Pages** with a **Cloudflare Worker** reverse proxy. Both production and staging use the same `/docs/` base path — routing is determined by hostname, not path prefix.

### Request flow

```
Browser → Cloudflare DNS → Worker (hostname lookup) → Cloudflare Pages → Response
```

1. DNS resolves the hostname (both are proxied CNAMEs in Cloudflare)
2. Cloudflare routes `/docs` and `/docs/*` to the Worker (via `wrangler.toml` route patterns)
3. Worker looks up the hostname in a `TARGETS` map to find the Pages deployment target
4. Worker rewrites the hostname and fetches from Pages (e.g. `marketdata-docs.pages.dev/docs/api/stocks`)
5. Pages serves the file from its `docs/` directory (built and nested there by CI)
6. Worker returns the response — the URL path stays the same throughout

### Environments

| Environment | Hostname | Pages Project | Git Branch |
|-------------|----------|---------------|------------|
| Production | `www.marketdata.app` | `marketdata-docs` | `main` |
| Staging | `www-staging.marketdata.app` | `marketdata-docs-staging` | `staging` |

### Worker features

The Worker (`worker/handler.js`) handles more than just proxying:

- **Markdown serving** — Requests with `.md` extension or `Accept: text/markdown` header return cleaned markdown fetched from the raw GitHub source (frontmatter and JSX stripped)
- **SDK PHP redirect** — `/docs/sdk-php/*` redirects to GitHub Pages (301)
- **Edge caching** — Subrequests use `cf.cacheEverything`
- **404 logging** — Logs pathname and referer for missing pages
- Non-docs paths pass through to the origin (WordPress)

## Deployment

Deployment is fully automated via GitHub Actions (`.github/workflows/deploy-docs.yml`).

1. Push to `staging` — builds and deploys to the staging Pages project
2. Verify changes at `www-staging.marketdata.app/docs/`
3. Open a PR from `staging` → `main` and merge — deploys to production

The CI pipeline builds Docusaurus, restructures the output to nest under `docs/`, generates cache headers, uploads to R2, and deploys to Cloudflare Pages. If files in `worker/` changed, it also runs worker tests and deploys the Worker.

## Testing

```bash
# Worker unit tests
cd worker && yarn test

# Integration tests (markdown serving against live site)
cd worker && TEST_ENV=staging yarn test:integration

# E2E tests (Playwright — Context7 widget)
TEST_ENV=staging yarn test:e2e
```

## Project Structure

```
api/              # API reference docs (MDX)
sdk/              # SDK docs — Go, Python, PHP (MDX)
sheets/           # Google Sheets Add-On docs (MDX)
account/          # Account & billing docs (MDX)
src/
  theme/          # Swizzled Docusaurus theme components
  css/            # Custom styles
worker/           # Cloudflare Worker reverse proxy
e2e/              # Playwright end-to-end tests
.github/workflows # CI/CD pipeline
```

## Search

Search is powered by [Algolia DocSearch](https://docsearch.algolia.com/). The crawler configuration is managed in the Algolia dashboard, not in this repository.

## License

MIT
