# Documentation Project

## Hosting & URLs

- Docs site is hosted on **Cloudflare Pages**. There is no longer a Worker in front of it
- Both environments use the same `/docs/` base path — routing is by hostname, not path prefix

| Environment | URL                                | Pages Project                | Branch    |
|-------------|------------------------------------|------------------------------|-----------|
| Production  | `www.marketdata.app/docs/`         | `www-marketdata-app`         | `main`    |
| Staging     | `www-staging.marketdata.app/docs/` | `www-staging-marketdata-app` | `staging` |

## Architecture

### Request flow

1. DNS resolves the hostname (both are proxied CNAMEs in Cloudflare)
2. Cloudflare serves the request from Pages directly
3. Pages serves the file from its `docs/` directory (built and nested there by CI)

### The retired edge worker

**The worker is gone.** `marketdata-docusaurus-proxy` was retired on 2026-09-01
(MarketData-App/www-marketdata-app#15) and nothing proxies `/docs/*` any more.
The `worker/` directory in this repo holds no tracked files; if you have one
locally it is a leftover `node_modules`.

Every behaviour it had is now served by Cloudflare or by the build:

| Behaviour                           | Now served by                                                     |
|-------------------------------------|-------------------------------------------------------------------|
| hostname-based routing              | nothing — Pages answers each hostname directly                    |
| `Accept: text/markdown` negotiation | a Cloudflare Transform Rule, live on both hostnames               |
| canonical `Link` on `.md` responses | `_headers` rules in the orchestrator — see below                  |
| `content-type` on `.md` responses   | nothing — Pages types all three twin names correctly on its own   |
| the legacy `/docs/sdk-php/*` space  | `_redirects`, generated from `SDK_PHP` in `redirects.js`          |
| `/docs/robots.txt` returning 404    | nothing — the build writes no `robots.txt`, so it 404s on its own |
| 404 logging                         | Cloudflare zone analytics, which exposes referer on this plan     |

#### The canonical `Link` header was replaced, not lost

MarketData-App/www-marketdata-app#16 planned to accept the loss and fixed it
instead, closed 2026-09-01. Markdown responses still carry:

```
link: <https://www.marketdata.app/docs/api/stocks/candles/>; rel="canonical"
```

It comes from `_headers` rules that live in **`MarketDataApp/www-marketdata-app`**,
not here, and they cover both halves of the origin rather than just `/docs/`.

**`_headers` is not first-match-wins.** Every matching rule applies and a
repeated header name *appends*, so the obvious three rules serve two canonicals
on the `index` spellings — `/*.md` matches `/docs/x/index.md` with a greedy
splat and names `/docs/x/index/`, a route that does not exist. The fix is `!
Link` in each specific rule, unsetting before setting, with the broad rule
first. **That order is load-bearing**; reversed, the file still parses, still
deploys, and quietly serves two canonicals again. `headers.test.mjs` in that
repo has a test named for it.

### CI/CD pipeline

**Docs repo** (`.github/workflows/deploy-docs.yml`):

1. Builds Docusaurus (`yarn build`)
2. Restructures build output to nest under `build/docs/`
3. Generates `_headers` file for asset cache control
4. Uploads build to R2 (`www-marketdata-app-builds` bucket) at `{env}/sources/docs/`
5. Triggers orchestrator via `repository_dispatch`

The "Check if Worker changed" / "Test Worker" / "Deploy Worker" steps were
removed when the worker retired. `main` still carries them until `staging`
merges into it — see the note in `deploy-docs.yml`.

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

Algolia DocSearch. App `IUHZFO750H`, index `Market Data Documentation`,
crawler `f42f78d6-acf4-4160-80e8-c69558fa87a5` on `crawler.algolia.com`.

**The index went six months stale and nothing said so.** The crawler was
created 2026-02-24 with `schedule: null`. It ran once for three minutes and was
never told to run again. On 2026-09-04 the index still held that crawl: the
entire C# SDK returned zero hits, so did every Go page added since, and 418
searches in 90 days had run against it. The crawler read `running: true`,
`blocked: false`, no errors and no failed run — there was nothing to find,
because a stale index and a fresh one are the same shape, answer in the same
time, and render identically. **A visitor cannot miss a page they do not know
exists**, so the only instrument that can see this is one that asks the index
how old it is. That is `lint:algolia`, and its A2 rule is the whole reason the
file exists.

Repaired 2026-09-04: schedule set to `every 1 week on monday at 6:00 am`,
reindexed (102s), 4,983 → 5,161 records, 267 of 268 sitemap routes covered.
The gap is `/docs/search/`, the search UI, which has no content to index.

### There is no admin key, and that decides the order of every repair

Algolia keeps the admin key for a DocSearch-provisioned application. The
dashboard exposes four: Search (public, in `docusaurus.config.js`), Analytics,
Usage, and Monitoring. **Monitoring is a paid feature and answers 401/403 for
this application** — the key is in `.env` only so nobody rediscovers that.

So nothing here can write index settings. A ranking change must go into the
crawler's `initialIndexSettings` **before** a reindex, never after, because
afterwards there is no way to put it back.

That trap was live on 2026-09-04. `hierarchy.lvl1` ranks above
`hierarchy.lvl0` — a deliberate departure from the Docusaurus default — and it
existed **only on the index**, while the crawler config still listed `lvl0`
first. The config was corrected before the reindex ran, so the tweak survived.
`lint:algolia` A7 is what keeps the two from drifting apart again.

### Ranking: the `pageRank` tiers

`weight.pageRank` was **0 on every record** until 2026-09-04, and it is the
first term in `customRanking`:

```
customRanking: [desc(weight.pageRank), desc(weight.level), asc(weight.position)]
```

Flat at zero it decided nothing, so a tie fell through to insertion order — and
the SDK section outnumbers the API reference **3,323 records to 928**. A search
for `rate limit` returned `/sdk/php/utilities/user/` over `/api/rate-limiting/`
with the two records identical on every ranking signal.

The crawler's single action is now five, each setting a `pageRank` on the
records it produces. **`pageRank` is not an action property** — the schema
rejects it there; it goes inside the DocSearch helper's `recordProps`.

| Action    | Paths                        | pageRank |
|-----------|------------------------------|----------|
| `api`     | `/docs/api/**`               | 100      |
| `sheets`  | `/docs/sheets/**`            | 100      |
| `account` | `/docs/account/**`           | 100      |
| `rest`    | everything else, by negation | 50       |
| `sdk`     | `/docs/sdk/**`               | 30       |

**The actions must stay mutually exclusive.** Every matching action runs, so an
overlapping pattern duplicates every record on the page. `rest` excludes the
other four by `!` negation, and the crawler's `/test` endpoint reports the
action groups a URL matches — it read `action_groups=1` for one URL per tier
before the reindex.

**Only the SDK is demoted, and that is deliberate.** A first pass also demoted
Sheets to 70. It fixed `troubleshooting` and broke `optionchain`, which stopped
returning the Sheets function literally named `OPTIONCHAIN`. Sheets and account
pages are function references whose name IS the query; the measured problem was
API versus SDK and nothing else.

### What pageRank cannot fix, and must not

`custom` is the **last** ranking criterion. A page that matches the query text
better wins before `pageRank` is ever consulted, which is correct and is why
this lever is safe.

It is also why the score stopped at 8 of 20. **The SDK page titles embed the
section name.** `Stock Candles (Python SDK)` matches both words of `stock
candles`, adjacent and exact; `/api/stocks/candles` is titled `Candles` and
matches one. The API page loses on `words` and never reaches the tie-break.

That is a content problem, not a ranking one. It is fixed by titling the API
pages for the concept (`Stock Candles`, not `Candles`), not by any crawler
setting. Raising `pageRank` further would change nothing.

### Watching it

`yarn lint:algolia` (`scripts/lint-algolia.js`, logic in `lib/algolia.js`).
Runs daily in `.github/workflows/algolia-watch.yml`, **not** in PR checks: no
pull request can make the index stale or fresh, and a check people cannot act
on is one they learn to skip.

**C1, C2 and B3 ask whether a search returns the RIGHT page**, which no other
rule here can. A2 proves the index is fresh, A5 proves every route is in it,
and both were green while five of twenty asserted queries answered badly. The
table is `lib/algolia-relevance.js`.

| Rule | Asks                                                      | Verdict  |
|------|-----------------------------------------------------------|----------|
| C1   | a query that used to return the right page no longer does | gated    |
| C2   | a **known gap has started passing** — the table is stale  | gated    |
| B3   | the known gaps themselves                                 | reported |

C2 is the one that keeps the list honest. Without it a gap list becomes a
graveyard of things fixed long ago that nobody removed, and stops describing
the index. It names the line to delete.

**The passing rows are the point, not the failing ones.** Ranking is a single
global lever, so a change made for one query moves others. The first `pageRank`
tier fixed `troubleshooting` and silently broke `optionchain`; the score was
8/20 before and after, so only the individual rows could see it. **Take the
baseline before touching ranking, never after.**

Rules A1–A3 and A5–A7 need no secret — they use the public search key, so the
check cannot be silenced by a missing environment variable. A4, B1 and B2 need
`ALGOLIA_USAGE_API_KEY`, `ALGOLIA_ANALYTICS_API_KEY` and the crawler pair, and
they report themselves SKIPPED by name rather than passing quietly.

**A2 and A4 measure the same event through different instruments on purpose.**
`updatedAt` moves for any write, including a settings edit that indexes no
content; the log names the operation. A settings-only touch refreshes A2 and
leaves A4 red, which is a state worth seeing rather than one to average away.

Two limits the check states on every run rather than hiding:

- The public key cannot `browse` (403) and pagination stops at 1,000 hits, so
  the index is swept one `docusaurus_tag` × `type` facet cell at a time. One
  cell (`docs-sdk-current/content`) exceeds that cap. A capped cell is **not** a
  missing page, so every apparent miss is confirmed with a second, targeted
  query before anything is reported.
- `url` is not a searchable attribute on this index. Asking for
  `restrictSearchableAttributes: ['url']` fails with an error that does not say
  why.

## The `/internal/` section

`/docs/internal/` holds our own reference material — today the on-page SEO
requirements every Market Data site must meet. Its own docs plugin instance,
absent from `themeConfig.navbar.items`, so it is reachable by URL and shows the
section's sidebar once you land.

**Every page in it is `noindex`, stamped by `plugins/internal-head.js`.** Not
front matter: `unlisted: true` would also drop the page from the sidebar in a
production build, and a `<head>` block in MDX renders as literal text here and
produces no tag at all. The full reasoning is in `lib/internal-head.js` and in
`docs/SEO.md`.

`lint:seo` M1 fails the build when a page there arrives without the tag. The
sitemap excludes the section by route; `llms.txt` excludes it by **stem**, in
`lib/llms-txt.js`, because postBuild hooks run concurrently and reading a
stamped page would be a race.

A page here needs no special front matter, and must not use `unlisted: true`:
that also drops the page from the sidebar in a production build. Give it a
`title` and let the frontmatter render the `<h1>` — a `#` heading in the body
suppresses the theme's own header, which puts the Markdown actions row **above**
the title instead of below it.

### A noindex page emits no canonical

`plugins/noindex-head.js` also strips the canonical from every page that says
`noindex`, which is Google's guidance and `MarketDataApp/website`'s ruling
(`SEO-DECISIONS.md` #15). This site did not follow it, and the gap was not the
four production pages — **`noIndex: process.env.PROD !== "true"` marks the whole
staging build noindex, and every page there also carried a canonical naming
`www-staging.marketdata.app`.** 265 canonicals per staging build. Gated by C1,
in both directions.

`og:url` and the JSON-LD `@id` are untouched, which is the same line the
website's ruling draws. That matters beyond tidiness: **`lint:seo` resolves the
build's environment from `og:url`**, because the canonical it used to read is
gone from staging.

### The tag pages are gone

`ignorePatterns` is matched against the path including `baseUrl`, which is why
the sitemap's `/internal/` rules name `/docs/`. The old `/tags/**` rule did not,
and had never matched anything — tag routes are `/docs/api/tags/…`, nested per
docs instance — so seven tag pages sat in the production sitemap.

They were retired on 2026-09-04 rather than corrected, with the `tags:` front
matter that generated them. Nothing was lost: every tagged page also carried an
equivalent `sidebar_custom_props: { badge }`, which is what renders the Premium
/ Beta / High Usage chip. The tags produced only those pages and a footer link
row pointing at them. All seven redirect to their section root, because they
were in the sitemap and so may be indexed.

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
does not.** It cannot be a warning. The retired worker answered `Accept:
text/markdown` by *falling through* to the HTML proxy for a twin-less route, so
the gap was invisible from outside — `/docs/` returned HTML rather than 404.
The Cloudflare Transform Rule that replaced it rewrites `<route>` to
`<route>index.md` unconditionally and cannot fall through, so a route with no
twin is a 404 today, with no deploy and no other cause.

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

## The Markdown Actions Row

`src/theme/DocItem/MarkdownActions/` renders under every doc's h1:

    🕐 Last updated Sep 2, 2026 │ ⧉ Copy as Markdown │ M↓ View as Markdown

Ported from `MarkdownActions.astro` in `MarketDataApp/website`, so both halves
of the origin present the same control. It also emits the only structured data
on these pages: `<time datetime>`, `article:modified_time`, and a JSON-LD
`TechArticle` whose `url` must equal `<link rel="canonical">` — the site sets
`trailingSlash: true` and `metadata.permalink` does not carry one.

**The date needs full git history at build time.** `showLastUpdateTime` reads
each file's last commit, so `deploy-docs.yml` and the building job in
`pr-checks.yml` check out with `fetch-depth: 0`. Under a shallow clone every
page reports the same date and **nothing reports it** — the row renders and
looks correct either way. `e2e/markdown-actions.spec.js` asserts two pages
carry different dates, which is the only way to see that from outside.

Two more traps that stylesheets do not report:

- Infima does not declare `--ifm-heading-color` on `:root`. `var()` on it is
  invalid, `color` computes to `unset`, and because colour inherits, the rule
  appears to apply while the colour never moves. Reading the variable back on
  an element inside `.markdown` returns the inherited heading colour and looks
  like a successful lookup.
- Infima's emphasis scale is not symmetric. `--ifm-color-emphasis-600` is
  3.06:1 on white and 11.1:1 on the dark ground, so a single token cannot serve
  both themes. Light uses `--ifm-color-content-secondary` (7.18:1).

## Testing

- **Converter tests**: `yarn test:lib` — `cleanMdx` (MDX→Markdown) and `cleanHtml` (built HTML→Markdown), the two twin converters
- **Redirect tests**: `TEST_ENV=staging yarn test:redirects` — verifies every rule in `redirects.js` answers 301 for GET and HEAD, in both slash forms
- **Sitemap tests**: `TEST_ENV=production yarn test:sitemap` — fetches the deployed sitemap and requires every URL to answer 200. On staging it asserts the opposite: a `noIndex` build must publish no sitemap
- **Example parity**: `yarn lint:examples` — every language tab on an API page must make the same request with the same inputs (#167). Compares a normalised fixture set, so `2024-01-01`, `LocalDate.of(2024, 1, 1)` and `new DateOnly(2024, 1, 1)` are one token
- **Highlighting**: `yarn lint:highlighting` — run after a build; fails when a ``` fence language produces no highlighting anywhere, which is what a missing Prism grammar looks like. Per language, not per block: a one-word shell command legitimately has nothing to colour. Add new languages to `additionalLanguages` in `docusaurus.config.js`, and use the id Prism knows (`ini` not `env`, `batch` not `cmd`)
- **Sitemap lint**: `yarn lint:sitemap` — builds with `PROD=true` and fails if the sitemap lists a URL with no page in `build/`
- **E2E tests**: `TEST_ENV=staging yarn test:e2e` — Playwright tests for Context7 widget rendering and the Markdown actions row (`TEST_BASE_URL=http://…/docs` points them at a local build instead)
- **Browser for e2e**: the machine's own Chromium, not a build this repo pins. `scripts/resolve-chromium.js` resolves it (`CHROMIUM_PATH` override → system browser → Playwright's bundled build) and `playwright.config.js` feeds it to `launchOptions`. Do not reintroduce a bare `browserName: 'chromium'` with no `executablePath` — that re-pins the browser to the installed `@playwright/test`. CI installs Playwright's build only when the runner has no browser. See README.md "Which browser the e2e tests run".
