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

1. Builds Docusaurus (`pnpm run build`)
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

**pnpm**, pinned by `packageManager` in `package.json`. Not yarn, not npm.
`MarketDataApp/website` was already on pnpm, so the origin is no longer mixed.

`pnpm-workspace.yaml` exists even though there is no workspace: pnpm 11 reads
its non-npm settings from that file. Two of its behaviours will stop an install
until you answer them, and both are deliberate.

**`allowBuilds` is a supply-chain gate.** pnpm runs no dependency install or
`prepare` script unless it is named there, and it FAILS rather than skipping
quietly, so an undeclared script cannot slip past. `@marketdataapp/ui` is a git
dependency, so pnpm wants to run its `prepare` on fetch; the key pnpm accepts is
the resolved tarball URL **including the commit sha**, and no shorter form
works. That is the useful part -- the approval covers one commit's code, not the
dependency in perpetuity. **Bumping the ui version therefore breaks the install
on purpose**: run `pnpm install`, read the new key it prints, satisfy yourself
the commit is ours, paste it in.

**pnpm does not hoist, so a phantom dependency fails loudly.** This found one
immediately: ten swizzled components in `src/theme/` import
`@docusaurus/theme-common`, which had never been in `package.json`. Under yarn
it resolved off the flat tree at whatever version `preset-classic` dragged in.
It is declared now.

### Never hardcode a generated class name

`src/css/custom.css` targeted `.tabItem_Ymn6`, a hashed CSS-module class from
`@docusaurus/theme-classic`. The hash follows the module's resolved path, so the
package-manager change moved it to `tabItem_VFbg` and **the rule silently
matched nothing** -- valid CSS naming a class no element carries, so no build
error, no warning, and tab backgrounds simply gone. A Docusaurus upgrade moves
it the same way.

The selector is `.tabs-container [role="tabpanel"]` now: `tabs-container` is a
plain unhashed theme class and `role="tabpanel"` is the ARIA role. Neither is
generated. **Only a diff of two builds could see this** -- see "Diff two builds
before believing an upgrade" below.

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

That is a content problem, not a ranking one. Nine API pages were retitled for
their asset class on 2026-09-04 — `Historical Candles` → `Stock Candles` — each
keeping a `sidebar_label` so the navigation did not move. Four queries flipped.

**Two got worse, and the mechanism is worth knowing before writing a title.**
`proximity` and the position of a match are both evaluated BEFORE `custom`:

- `bulk candles` — `Bulk Candles (PHP SDK)` holds the two words adjacent.
  `Bulk Stock Candles` separates them, so the SDK page wins on proximity.
- `earnings` — `Earnings (Go SDK)` matches at position 0, `Stock Earnings` at
  position 1.

So a qualifier helps when it adds a word the reader typed, and hurts when it
lands *between* two words they typed. Raising `pageRank` reaches neither case.

### Watching it

`pnpm run lint:algolia` (`scripts/lint-algolia.js`, logic in `lib/algolia.js`).
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

## Diff two builds before believing an upgrade

Every defect in the 3.10 / pnpm / `future.v4` migration was found this way, and
**not one of them failed a build.** The pattern is always the same: something
that renders, deploys and passes every gate, while being wrong.

Take a snapshot of `build/`, change one thing, take another, and compare.

**Measure the noise floor first** — build the same tree twice and diff those.
Anything that differs there is noise you must normalise before you can read a
real diff. That control is what found the `builtAt` bug below, and it is the
step to repeat rather than trust.

### The build is now byte-for-byte reproducible, and it was not before

Two builds of one tree differ in **nothing**. Measured across 1401 files, with
only `builtAt` normalised — and that field lives solely in `build-info.json`,
which is served `no-store` and whose whole purpose is to vary.

**This was false until the 3.10 upgrade**, in two separate ways, and both had
to be fixed to get here:

1. `builtAt` was passed to `plugins/build-info.js` as a plugin OPTION, and
   Docusaurus serialises the config — options included — into `main.js`. A
   clock in the client bundle moved its content hash every build.

   **What is serialised is the plugin's PATH and its OPTIONS, never its
   source.** So editing a plugin's code has never moved the bundle and still
   does not; only the VALUES you hand it do. Worth being exact about, because
   the opposite model — "the plugin is bundled" — predicts the same symptom for
   the wrong reason and would send the next person editing the wrong thing.

   Both shapes sit in the same array, two entries apart, which makes the rule
   readable straight out of the artefact rather than taken on trust:

   ```js
   plugins:["./plugins/build-info", …,
     ["@docusaurus/plugin-content-docs",{id:"api",path:"api",…}]]
   ```

   A plugin given options publishes them to every reader. A plugin given none
   costs nothing.

   **`require.resolve()` in this config is how the build machine's paths ship
   to every visitor.** It returns an ABSOLUTE path, and an absolute path handed
   to a plugin as an option is serialised like any other value.
   `sidebarPath: require.resolve("./sidebars.js")` put the checkout's full path
   into `main.js` five times over, once per docs instance, plus one for
   `customCss`. It reads as a robustness idiom and is nothing of the kind.
   Docusaurus resolves a relative string against `siteDir`, so `"./sidebars.js"`
   is both correct and silent.

   **It predated the upgrade and it is still live.** The production bundle
   built from 3.0.1 carries NINE of them —
   `/home/runner/work/documentation/documentation/…` — which is a GitHub
   runner's fixed layout and an already-public repository name. So the live
   disclosure is mild. The severity is in the shape, not today's value: the
   same config produces `/home/<user>/…` the day anyone builds production from
   a workstation or a self-hosted runner, which is exactly what it did here.

   Six came from this config. The other three name `.docusaurus/` internals, a
   source we do not control — and all nine are absent from the current build,
   so the upgrade plus the relative paths closed more than the six we set out
   to close. Verify with a strict pattern; a loose `/home/` match hits
   `https://script.google.com/home/all` in the Sheets docs and reports two
   false positives.
2. Docusaurus 3.0.1 wrote plugin `globalData` in the order the five
   content-docs instances happened to finish, which is not stable. So even
   after removing the clock, `main.js` was still a permutation of itself
   between builds. **3.10's Rspack pipeline made that ordering deterministic**,
   which is what closed the gap.

Two things follow, and the second is why it is worth a section:

- **A deploy no longer invalidates the primary bundle for no reason.** It used
  to publish a new `main.<hash>.js` on every build against a
  `max-age=31536000, immutable` header, and strand every mid-session reader —
  the exact reader `src/clientModules/chunkReload.js` exists to recover.
- **Diffing built HTML now proves something.** A head-only change can be
  verified by diffing the build directly, which is what this file has always
  claimed and could not actually deliver. If a future change reintroduces
  per-build variance, that claim quietly becomes false again — so if two builds
  of one tree ever start differing, fix that before trusting any other diff.

**Removing the clock was not enough, and the reasoning that stopped there is
worth reading.** `builtAt` came out of the plugin options; the commit sha was
deliberately left in, on the grounds that "a sha is stable for a given tree, so
it costs no bundle churn". True per tree, and beside the point: **every deploy
is a new commit.** A CLAUDE.md-only commit therefore still rehashed `main.js`
and rewrote all 265 pages, and the orchestrator measured it — 269 files
differing, every one identical once the sha was tokenised.

`plugins/build-info.js` resolves the commit itself now, so it never enters the
serialised config. Both consumers are build-time, and nothing in the browser
ever needed it. Measured across two real commits afterwards:

|                        |                                                        |
|------------------------|--------------------------------------------------------|
| asset files changed    | **0** — `main.js` keeps its hash                       |
| non-HTML files changed | 1 — `build-info.json`, which exists to vary            |
| per page               | one attribute, `<meta name="build-commit">`, by design |

**The rule this yields:** anything a plugin needs at build time should be
resolved inside the plugin. An option is a value published to every reader and
charged to the bundle hash, and neither of those is visible at the call site.

`plugins/build-info.js` now enforces that on itself: its `postBuild` fails when
`main.<hash>.js` contains a 40-hex git sha or an ISO timestamp. **It is a
property check, not a measurement, and the difference is the point.** "Rebuild
twice and diff the assets" is a sample — true of the two commits you tried, and
needing repeating forever. "No build-varying value is in the bundle" is checked
once and settles every commit after it. Reach for that shape whenever the claim
is about what *cannot* happen; it is cheaper and stronger at the same time.

It fails on a missing bundle rather than passing, for the reason in "a count in
a log is not a check" above, and it looks for 40 hex rather than 32 because the
public Algolia search key is 32 hex, stable, and legitimately in the bundle.

What that instrument found, none of which was visible any other way:

| Defect                                                  | What the build said |
|---------------------------------------------------------|---------------------|
| a clock in the client bundle, busting it every deploy   | success             |
| a CSS rule naming a class no element carries            | success             |
| `article:modified_time` set to the year 58,641          | success             |
| llms.txt losing all 259 descriptions                    | success             |
| a swizzle so stale it reported 234 false broken anchors | success (warnings)  |

### Never hardcode a generated name, and never regex a quoted attribute

Two habits produce most of that table.

**A hashed CSS-module class is not a name you may write down.** `.tabItem_Ymn6`
moved when the package manager changed, because the hash follows the module's
resolved path. The rule stayed valid and matched nothing.

**Built HTML does not promise how it spells an attribute.** This is what
`build/` actually contains today — copy it before writing any pattern against a
built page:

```html
<meta name=build-commit content=a99b8391e31620b55ce53b9b325856d4a4331494>
<h2 class="anchor anchorTargetStickyNavbar_WZc3" id=headers-type>
```

**Unquoted wherever the value needs no quote**, and quoted where it does — in
the same tag. `future.v4`'s Faster pipeline minifies harder than 3.10 did.
`lib/llms-txt.js` required the quotes, so every description vanished and
llms.txt fell from 55 KB to 23 KB — a structurally valid index, so nothing
failed.

**Knowing this does not protect you.** On the day it was found, the
orchestrator's agent read the defect report, quoted the example back, and then
wrote `grep -o 'name="build-commit"[^>]*'` against this build ten minutes
later. It reported the tag missing from all 265 pages. It was caught only
because "missing" contradicted a measurement made minutes earlier — not because
the rule had been read. Two other greps here were fooled the same way, and one
of them was in this file's own checker.

So: use `grep -a` with a quote-agnostic pattern, or parse. Do not rely on
remembering.

`lib/not-found-head.js`'s `attributesOf` came through untouched because it
accepts all three HTML5 forms: `"x"`, `'x'`, and bare. Copy that, or parse with
`@mixmark-io/domino`, which is why `lint:seo` uses it and why `lint:seo` was
the check that did not care.

### A count in a log is not a check

The llms.txt collapse **printed both of its own symptoms** — `23 KB` where it
had been 55, and `259 without a description` where it had been 0 — on the line
the build writes every time. Nothing gated on either, so the build was green
and the file shipped gutted.

Reporting a number is not the same as asserting one. `plugins/llms-txt.js` now
throws when a MAJORITY of entries have no description, and there is a
deliberate asymmetry in that threshold: the failure is all-or-nothing, because
the pattern either matches the build's spelling or it does not. One page
without a description is ordinary content; half of them cannot be.

`scripts/check-highlighting.js` has the older version of the same idea, and its
wording is the one to copy: *"a tripwire for a walk that stopped matching, not
a content baseline. Do not lower the floor to make it pass."*

**A structural gate reports success over gutted substance.** `llms.txt` with
every description stripped still had one H1 first, no H6, and 260 lines
reaching `/docs/` — so this repo's `lint:contract` passed it, and so did the
orchestrator's splice preconditions, which demote its headings and require
exactly those properties. Both gates asked *can this be spliced*. Neither asked
*is it still worth splicing*.

### The thin twins are expected

16 routes produce a Markdown twin under 200 bytes, and `sheets/stocks.md` is 17
bytes against an 18 KB HTML page. **This is correct, and it is worth writing
down because it is byte-indistinguishable from the defect above.**

Those pages are hubs whose entire body is `<DocCardList items={...} />`. That is
navigation, not prose, and `cleanMdx` drops JSX — so the twin is the title and
nothing else. Where such a page also has prose, the prose is there:
`api/stocks.md` is 181 bytes and carries every sentence its source has.

They have sources; they are not generated category indexes. Do not "fix" them,
and do not add a twin size floor — a legitimately thin hub and a twin gutted by
a parser regression are the same size, and only the description floor above can
tell those apart.

### Six built pages contain a NUL byte, and grep skips them silently

A stray `\x00` lands immediately before certain U+20xx characters (em dash,
zero-width space, curly apostrophe). It predates all of this -- the 3.0.1
baseline has it -- and the count and the pages move between builds.

It matters because **grep treats a file containing NUL as binary and skips it
with no message.** A robots-meta count came up six pages short during this work
and the tag was present all along. Use `grep -a` on built HTML, and prefer a
parser. `scripts/check-build-contract.js` does not report it; the migration
harness did.

## Swizzles: a fork you do not maintain is a fork that lies

`src/theme/` was 27 components. **Eleven had no local changes at all** -- ten
already matched upstream 3.10, one was a stale copy of 3.0.1. They were deleted
in the 3.10 upgrade, because a swizzle with no customisation can only fall
behind upstream, and one of them proved what that costs.

`src/theme/Heading` was a byte-for-byte fork of the 3.0.1 file. Upstream had
since added `brokenLinks.collectAnchor(id)` -- the call by which a page
registers the anchors it defines. Ours never made it, so every page declared
none, and when 3.10 began checking anchors it reported **254 broken, of which
234 were not broken at all.** Deleting the swizzle fixed all 234.

**Before upgrading Docusaurus, classify every swizzle against upstream.**
Normalise away comments, quote style, trailing commas and whitespace, then
compare each file in `src/theme/` with the same path in
`node_modules/.pnpm/@docusaurus+theme-classic@<version>/.../lib/theme/`. Delete
anything that matches. Reconcile the rest by hand -- and check the sibling
`styles.module.css` separately, because a component and its stylesheet drift
independently.

Twelve customised swizzles and four of our own remain.

## `future.v4` is on, and one flag needed a counterweight

`future: { v4: true }` in `docusaurus.config.js` turns on all five v4 flags
early, so the major is a version bump rather than a migration. Four were free.

**`siteStorageNamespacing` was not, and it would have failed silently.** It
namespaces browser storage: `theme` becomes `theme-f3b`, a hash of the site's
url and baseUrl. That exists so two Docusaurus sites on one domain cannot read
each other's preferences -- and **we want them to.** `theme` is a contract
across the whole origin: `plugins/theme-cookie-sync.js` seeds it from the
`.marketdata.app` cookie, and `@marketdataapp/ui`'s `theme.js`, used by every
other property, reads the same unprefixed key. With the flag on, the built
bootstrap read `theme-f3b` while our bridge still wrote `theme`, so a reader
who chose dark mode on the marketing site arrived here in light mode.

`storage: { namespace: false }` pins it. Namespacing it "properly" is not
available: the hash comes from the url, so staging and production would
disagree with each other and with the marketing half, which cannot know either
value.

The other four, for the record: `removeLegacyPostBuildHeadAttribute` is free
because no plugin here takes `head` in `postBuild`; `useCssCascadeLayers`
changed no rule we own; `mdx1CompatDisabledByDefault` needed content work,
below.

**`fasterByDefault` is the one with a number attached.** Same tree, same
machine, only that flag moved:

| Bundler                         | Full `pnpm run build` |
|---------------------------------|-----------------------|
| webpack (`fasterByDefault` off) | 56s                   |
| Rspack + SWC (on)               | **8s**                |

It needs the `@docusaurus/faster` dependency, and that pulls in `@swc/core` --
the one dependency here whose install script does real work, since it resolves
a native binding. It is `true` in `pnpm-workspace.yaml` for that reason, unlike
`core-js`, which is declined.

### React 19

**v4 drops React 18**, so `future.v4` without React 19 is only half ready. The
bump was measured the same way as everything else: every built page identical
in text content, all 794 Markdown twins byte-identical, llms.txt, sitemap.xml
and `_redirects` byte-identical, 229 lib tests, 103 script tests and 14 e2e
tests green.

3.10 accepts `^18.0.0 || ^19.0.0`, so this is separable from the rest of the
migration if it ever needs to come out.

### Strict MDX: `{#id}` is JavaScript now

With MDX v1 compatibility off, `## Title {#my-id}` is parsed as a JS
expression and fails the build. The supported spelling is `{/* #my-id */}`, and
it also stops the id leaking into the page's Markdown twin.

**`<!-- -->` inside a code fence is not affected and must not be converted.**
Only prose comments were ever compat-handled. A blanket rewrite here corrupted
an XML sample in `sdk/csharp/installation.mdx` before the build diff caught it.

Admonition titles (`:::note Some Title`) are unaffected -- 75 of them build
identically with the flag on.

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

## Reading the orchestrator's log after a deploy

Our deploy ends at a `repository_dispatch` into
`MarketData-App/www-marketdata-app`. What happens next is in THAT repo's run
log, and this is how to read it.

```bash
gh run list --repo MarketData-App/www-marketdata-app \
  --workflow "Orchestrator: Merge Sources & Deploy to CF Pages"
gh run view <id> --repo MarketData-App/www-marketdata-app --log | grep -a "sitemap"
```

**Read the log body, not the run metadata.** `gh run list` shows every
orchestrator run as branch `main`, trigger `repository_dispatch`, with an
identical display name — **whether it deployed staging or production.** The only
reliable marker is `(environment: staging)` inside the step output. Verified on
two real runs 25 minutes apart:

| Run         | Metadata says | Actually was | Sitemaps    |
|-------------|---------------|--------------|-------------|
| 33922876619 | `main`        | staging      | 110 URLs, 1 |
| 33924580277 | `main`        | production   | 370 URLs, 2 |

A correct **staging** run prints, and this is success rather than a problem:

```
build/docs/sitemap.xml is absent, and staging does not require it.
Nothing spliced; the index is unchanged.
110 URL(s) declared in total, across 1 sitemap(s).
```

Our `noIndex` build publishes no sitemap, so there is nothing to splice. **If
staging ever reports 2 sitemaps and 370 URLs, this repo emitted a sitemap under
`noIndex`** — not a failure there, but a change here worth finding.

**The sitemap requirement is production-only and was added 2026-09-04**, which
makes it the youngest gate in the chain and the first place to look if a
production deploy surprises you. Every other production-only behaviour has run
many times. Its error text names its own suspects.

## The build sentinel

**Which commit is deployed, in one request with an exact answer.**

The orchestrator merges `MarketDataApp/website` and this repo into ONE
Cloudflare Pages deployment, so "what is live?" is two questions and neither
source could answer either. The format is agreed with that repo (2026-09-04) so
both halves answer identically, each under its own prefix so nothing collides
in the merge:

|                                                   |         |
|---------------------------------------------------|---------|
| `https://www.marketdata.app/build-info.json`      | website |
| `https://www.marketdata.app/docs/build-info.json` | here    |

```json
{ "source": "documentation", "commit": "<40 hex>", "ref": "main",
  "environment": "production", "builtAt": "2026-09-04T16:08:31.369Z" }
```

The sha is **full length** by agreement: an abbreviation is ambiguous across
two repositories and cannot be handed back to `git`.

Written by `plugins/build-info.js` in postBuild, from `lib/build-info.js`. The
commit is resolved **once**, in `docusaurus.config.js`, and handed to the
plugin — two call sites resolving it separately would be two ways to answer one
question, and they would disagree the day somebody changed one.

### Three traps, each of which defeats the whole thing

**A cached sentinel is worse than none** — it answers about a previous deploy
while looking authoritative. `deploy-docs.yml` sets `no-store` on it. Remember
`_headers` is not first-match-wins: every matching rule applies and a repeated
header name *appends*. None of the three cache rules above it matches
(`/*.js` needs a literal `.js`, this is `.json`), so it stands alone — but a
broad rule added here, or in the website half the orchestrator concatenates
with, would break that.

**A dirty tree must not publish a clean sha.** `git rev-parse HEAD` answers
happily with uncommitted changes, so a hand-run build would publish a commit
whose content is not what was built. `dirty: true` appears then, and only then,
so a deployed sentinel is exactly the five agreed fields.

**The page and the endpoint can legitimately disagree.** Pages are edge-cached
and the sentinel is not, so the document in front of a reader may come from an
older build than `/docs/build-info.json` reports. That is two cache states, not
a defect — and it is precisely the reader `src/clientModules/chunkReload.js`
exists for. Every page therefore carries `<meta name="build-commit">` with its
own provenance.

**That tag is the commit and nothing else.** No timestamp, no other
per-build-varying value: two builds of one tree must differ only where they are
already known to, or a head-only change cannot be verified by diffing built
HTML. It was the other repo's condition on the shared format and it is worth as
much here, where `lib/build-freshness.js` and several checks read built HTML.

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

- **Converter tests**: `pnpm run test:lib` — `cleanMdx` (MDX→Markdown) and `cleanHtml` (built HTML→Markdown), the two twin converters
- **Redirect tests**: `TEST_ENV=staging pnpm run test:redirects` — verifies every rule in `redirects.js` answers 301 for GET and HEAD, in both slash forms
- **Sitemap tests**: `TEST_ENV=production pnpm run test:sitemap` — fetches the deployed sitemap and requires every URL to answer 200. On staging it asserts the opposite: a `noIndex` build must publish no sitemap
- **Example parity**: `pnpm run lint:examples` — every language tab on an API page must make the same request with the same inputs (#167). Compares a normalised fixture set, so `2024-01-01`, `LocalDate.of(2024, 1, 1)` and `new DateOnly(2024, 1, 1)` are one token
- **Highlighting**: `pnpm run lint:highlighting` — run after a build; fails when a ``` fence language produces no highlighting anywhere, which is what a missing Prism grammar looks like. Per language, not per block: a one-word shell command legitimately has nothing to colour. Add new languages to `additionalLanguages` in `docusaurus.config.js`, and use the id Prism knows (`ini` not `env`, `batch` not `cmd`)
- **Link and anchor checking**: two halves, split by whether the answer needs the network.
  - `pnpm run lint:links` — a build with `STRICT_LINKS=true`, so **both** `onBrokenLinks` and `onBrokenAnchors` throw. Runs in PR checks. Deploys build with `warn`, so this is the gate that keeps a broken link *or a broken fragment* off the site. **An anchor is the half of a link nothing else can see**: `onBrokenLinks` proves the page exists and says nothing about the fragment, so a deep link can point into a page that renders perfectly and land the reader nowhere. That is how 26 of them survived being written, invisible until 3.10 started checking
  - `pnpm run lint:external-links` — off-site URLs, from the **built HTML** via domino. Weekly, `not` in PR checks, for the reason `lint:algolia` gives: no pull request can make a third-party site go down, and a check that reddens for reasons the author cannot fix is one people learn to skip. **The fragment is deliberately ignored on external links** — we do not own their heading ids, and many pages build anchors in the browser, so asserting one produces failures nobody can act on. Only 404/410 fail; a timeout, 429, 5xx or 403 is reported as unreachable and never counted as a pass. `KNOWN_BROKEN` lists genuine failures with their issue, and **fails when a listed URL starts working**, which is `lib/algolia-relevance.js`'s C2 rule applied here so the list cannot become a graveyard
- **Sitemap lint**: `pnpm run lint:sitemap` — builds with `PROD=true` and fails if the sitemap lists a URL with no page in `build/`
- **Orchestrator contract**: `pnpm run lint:contract` — reads a built `build/` and asserts what `MarketDataApp/www-marketdata-app` requires of it. Not a duplicate of that repo's gates: it is the part we can answer before pushing. **The rule that exists nowhere else is `404.html`** — Cloudflare Pages serves the nearest one by walking up the tree, and ours terminates that walk for `/docs/*`; lose it and `/docs/*` quietly serves the marketing 404 with every gate in both repositories green. That repo asked us to assert it here because it cannot. Also covers the llms.txt demotion preconditions (one H1, first, no H6), the twins each resolving to `<route>/index.html`, the sitemap (required on production, forbidden under `noIndex`), and the two `_redirects` budgets shared with the website half
- **E2E tests**: `TEST_ENV=staging pnpm run test:e2e` — Playwright tests for Context7 widget rendering and the Markdown actions row (`TEST_BASE_URL=http://…/docs` points them at a local build instead)
- **Browser for e2e**: the machine's own Chromium, not a build this repo pins. `scripts/resolve-chromium.js` resolves it (`CHROMIUM_PATH` override → system browser → Playwright's bundled build) and `playwright.config.js` feeds it to `launchOptions`. Do not reintroduce a bare `browserName: 'chromium'` with no `executablePath` — that re-pins the browser to the installed `@playwright/test`. CI installs Playwright's build only when the runner has no browser. See README.md "Which browser the e2e tests run".
