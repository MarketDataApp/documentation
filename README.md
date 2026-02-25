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

## Deployment

The site is hosted on **Cloudflare Pages** with a **Cloudflare Worker** reverse proxy. Deployment is fully automated via GitHub Actions.

1. Push to `staging` — deploys to the staging site
2. Verify changes at the staging URL
3. Open a PR from `staging` → `main` and merge — deploys to production

The CI pipeline (`.github/workflows/deploy-docs.yml`) builds the Docusaurus site, restructures the output to nest under `/docs/`, generates cache headers, and deploys via Wrangler.

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
.github/workflows # CI/CD pipeline
```

## Search

Search is powered by [Algolia DocSearch](https://docsearch.algolia.com/). The crawler configuration is managed in the Algolia dashboard, not in this repository.

## License

MIT
