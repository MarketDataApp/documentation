# Market Data Documentation

The official documentation for [Market Data](https://www.marketdata.app/) — covering the REST API, SDKs, and Google Sheets Add-On. Built with [Docusaurus 3](https://docusaurus.io/).

**Production:** [www.marketdata.app/docs/](https://www.marketdata.app/docs/)
**Staging:** [www-staging.marketdata.app/docs/](https://www-staging.marketdata.app/docs/)

## Documentation Sections

| Section                | Path       | Description                                                         |
|------------------------|------------|---------------------------------------------------------------------|
| **API**                | `/api`     | REST API reference — stocks, options, funds, markets, and utilities |
| **SDKs**               | `/sdk`     | Client libraries for Go, Python, and PHP                            |
| **Sheets Add-On**      | `/sheets`  | Google Sheets Add-On documentation                                  |
| **Accounts & Billing** | `/account` | Account management, plans, billing, and entitlements                |

## Local Development

```bash
pnpm install    # Install dependencies
pnpm start      # Start dev server at localhost:3000
pnpm build      # Production build
```

This project uses **pnpm**, pinned by the `packageManager` field in
`package.json` so CI and every machine provision the same version. Both halves
of the origin are now on pnpm: `MarketDataApp/website` has been since before
this repo moved.

Two pnpm behaviours are worth knowing before your first install, both recorded
in `pnpm-workspace.yaml`:

- **pnpm refuses to run a dependency's install scripts until you say so**, and
  fails the install rather than skipping them quietly. `allowBuilds` there is
  the list of decisions. When pnpm meets a new one it writes a placeholder line
  for you to fill in; set it to `true` or `false` rather than deleting it.
- **pnpm does not hoist**, so a package you import must be one you declared.
  That is a feature: it caught `@docusaurus/theme-common`, which ten swizzled
  components in `src/theme/` had imported for as long as they have existed
  without it ever appearing in `package.json`. Under yarn it resolved by
  accident, at whatever version `preset-classic` happened to pull in.

## Architecture

The site is hosted on **Cloudflare Pages**. Both production and staging use the same `/docs/` base path — routing is determined by hostname, not path prefix. Deployment is handled by a separate orchestrator repo (`MarketDataApp/www-marketdata-app`) that merges build artifacts from R2 and deploys to unified Pages projects.

### Request flow

```
Browser → Cloudflare DNS → Cloudflare Pages → Response
```

1. DNS resolves the hostname (both are proxied CNAMEs in Cloudflare)
2. Pages serves the file from its `docs/` directory (built and nested there by CI)

### Environments

| Environment | Hostname                     | Pages Project                | Git Branch |
|-------------|------------------------------|------------------------------|------------|
| Production  | `www.marketdata.app`         | `www-marketdata-app`         | `main`     |
| Staging     | `www-staging.marketdata.app` | `www-staging-marketdata-app` | `staging`  |

### The retired edge worker

There used to be a Worker in front of Pages. It was retired on 2026-09-01
(MarketData-App/www-marketdata-app#15) and nothing proxies `/docs/*` any more.
Everything it did is now served by Cloudflare or by the build — including the
canonical `Link` header on Markdown responses, which `_headers` rules in the
orchestrator repo took over (#16). See CLAUDE.md for the full mapping and for
why those rules' order is load-bearing.

## Deployment

Deployment is fully automated via GitHub Actions across two repos:

1. **This repo** (`.github/workflows/deploy-docs.yml`) — builds Docusaurus, uploads to R2, triggers orchestrator
2. **Orchestrator** (`MarketDataApp/www-marketdata-app`) — downloads all sources from R2, merges into unified build, deploys to CF Pages, runs post-deploy tests

```
Push to staging/main → Build → Upload to R2 → Trigger orchestrator → Deploy to CF Pages → Tests
```

Workflow:
1. Push to `staging` — builds and deploys to staging
2. Verify changes at `www-staging.marketdata.app/docs/`
3. Open a PR from `staging` → `main` and merge — deploys to production

## Testing

```bash
# E2E tests (Playwright — Context7 widget, Markdown actions row)
TEST_ENV=staging pnpm run test:e2e

# Script tests (option-symbol checker, Chromium resolver)
pnpm run test:scripts
```

### Which browser the e2e tests run

The e2e suite runs against **whatever Chromium the machine already has** — `/usr/bin/chromium` on Linux, `Chromium.app`/`Google Chrome.app` on macOS — not against a build this repository pins. `scripts/resolve-chromium.js` picks it, and `playwright.config.js` uses that one resolver.

This is deliberate. `browserName: 'chromium'` is an invisible version pin: it resolves to the single revision bundled with the installed `@playwright/test`, so the browser under test only moves when someone bumps a devDependency and re-runs `playwright install`. That would make this repository the gate on every Chromium update. These specs load third-party script into a real page, so they should see the browser our readers run, the day their OS updates it, with no commit here.

- Every run prints the binary it chose (`Chromium: /usr/bin/chromium (system)`). Read that line first when an e2e test fails.
- Set `CHROMIUM_PATH=/path/to/binary` to force a specific browser.
- With no system browser found, it falls back to Playwright's bundled build, so a fresh clone still works after `npx playwright install chromium`.
- CI runs `node scripts/resolve-chromium.js || npx playwright install --with-deps chromium`, so the runner downloads a browser only when it has none.
- Trade-off: Playwright only guarantees the revision it bundles, so a system browser far ahead of it can drift on CDP behaviour. That is the price of not holding updates back, and it fails loudly rather than silently.

## Project Structure

```
api/              # API reference docs (MDX)
sdk/              # SDK docs — Go, Python, PHP (MDX)
sheets/           # Google Sheets Add-On docs (MDX)
account/          # Account & billing docs (MDX)
src/
  theme/          # Swizzled Docusaurus theme components
  css/            # Custom styles
lib/              # MDX→Markdown and HTML→Markdown converters (the twin converters)
plugins/          # markdown-twins, llms.txt, redirects
scripts/          # Build-time checks — see Testing
e2e/              # Playwright end-to-end tests
.github/workflows # CI/CD pipeline
```

## Search

Search is powered by [Algolia DocSearch](https://docsearch.algolia.com/). The crawler configuration is managed in the Algolia dashboard, not in this repository.

## License

MIT
