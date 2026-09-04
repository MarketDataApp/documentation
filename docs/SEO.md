# The SEO spec

What every built page in this repository emits, and what asserts it.

This document is not published. It sits in `docs/` beside the other specs and
is never served — `build/` contains no route for it.

## How to read this document

Each section states what the site emits and names the rule that gates it.
**When this document and `scripts/lint-seo.js` disagree, one of them is wrong
and you can tell which.** Without the prose, the check becomes the only
statement of intent, and nobody can review a script for whether it still
describes what was meant.

Rules are gated unless the section says otherwise. Everything measured but not
gated is listed under [Reported, never gated](#reported-never-gated), with the
flag that turns it on.

---

## Where these tags come from

Almost nothing here is written by this repository. Docusaurus's
`@theme/SiteMetadata` emits the title, description, canonical, `og:url`,
`og:title`, `og:description`, the `hreflang` alternates and `twitter:card`.
Two things are ours:

| Tag                                                           | Written by                           |
|---------------------------------------------------------------|--------------------------------------|
| `article:modified_time`, the JSON-LD block, `<time datetime>` | `src/theme/DocItem/MarkdownActions/` |
| everything else in the head                                   | Docusaurus `@theme/SiteMetadata`     |

That matters when a rule fails: the fix is usually a config change or a
swizzle, not an edit to a page.

One page's head is edited after Docusaurus writes it. `@theme/SiteMetadata`
emits four tags naming the page's own URL, and on the 404 all four name a URL
that 404s; `plugins/not-found-head.js` cuts them out of `build/404.html` in
`postBuild` and adds the `noindex` that page needs. See
[The 404 page](#the-404-page).

---

## Environment

The build resolves to exactly one environment, derived from the canonical host
in the artefact rather than from `PROD` — the env var is an *input* and this
check reads the *output*. When those two disagree it is the artefact that
ships.

|                | production                       | staging                                                    |
|----------------|----------------------------------|------------------------------------------------------------|
| canonical host | `https://www.marketdata.app`     | `https://www-staging.marketdata.app`                       |
| `robots`       | absent, except pages that opt in | `noindex, nofollow` on **every** page                      |
| `sitemap.xml`  | published                        | **none** — `plugin-sitemap` skips it when `noIndex` is set |

A canonical host that is neither is a deploy pointing somewhere unintended, and
every host-dependent rule below would otherwise pass silently.

*Gated by rule D0 (one known environment), D1 (staging noindex), D2 (sitemap).*

---

## `<title>`

Exactly one per page, with text, and more than the site name alone. Docusaurus
appends `| Market Data`, so a page whose own title is empty would emit
`| Market Data` and nothing else.

*Gated by rule A1 (presence), rule H1 (uniqueness) and rule I1 (60 characters
or fewer, counting the appended site name as production writes it).*

## `<meta name="description">`

Every content page has one. Navigation artifacts — the tag pages and the search
UI — do not, and are exempt.

**The exemption reuses `isNavigationArtifact()` from `lib/llms-txt.js`.** That
function already answers "is this route content, or scaffolding?" for the
`llms.txt` index. A second list here would be a second answer to one question,
and the two would drift.

Docusaurus derives the description from the page's first paragraph when the
frontmatter does not set one. That default produced descriptions of every wrong
shape: a bare heading (`"Problem Overview"`, 16 characters, on eight pages at
once), and 107 descriptions running past 160 characters to as many as 493.
Every content page now sets its own `description:` in frontmatter, so nothing
is derived and nothing repeats.

*Gated by rule B1 (presence), rule H2 (uniqueness) and rules I2 and I3
(160 characters or fewer, 70 or more).*

## Canonical URLs

Every route emits exactly one, absolute, naming itself. The site sets
`trailingSlash: true`, so the canonical always ends in `/`.

Three tags carry this page's URL and all three must agree:

```
<link rel="canonical" href="https://www.marketdata.app/docs/api/options/chain/">
<meta property="og:url" content="https://www.marketdata.app/docs/api/options/chain/">
{"@type":"TechArticle","url":"https://www.marketdata.app/docs/api/options/chain/"}
```

The JSON-LD one is ours and was wrong first time round: `metadata.permalink`
carries no trailing slash, so it named `…/chain` against a canonical of
`…/chain/` — two URLs for one page, which is worse than no structured data.

*Gated by rules C1 (exactly one, present), C2 (absolute, self-referential,
trailing slash), C3 (`og:url` and `og:description` agree with their sources),
F1 (JSON-LD agrees).*

### Every built page's twin must still be in the build

`plugins/markdown-twins.js` fails the build when a route has no Markdown twin,
so the guarantee is enforced — at build time, by the same code that writes
them. Rule **G1** re-checks it afterwards from an independent walk: it starts
from the built HTML this check already enumerates, not from the plugin's route
list.

Two reasons that is worth a second assertion rather than trust:

- **#188.** `aws s3 sync --delete` removed files from R2 *after* the build that
  had just produced them. Pages, that time. Losing an artefact between the
  build and the deploy has happened here.
- Every doc page now links to its twin from the actions row, so a missing one
  is a 404 a reader can click, not only an agent's problem.

Two checks pinned to one artefact cannot disagree without one of them failing.
That is the argument D2 already makes about robots and the sitemap, applied one
level out — and it is the structural answer to a guarantee that otherwise holds
only because two checks happen to overlap, with nothing stating that it holds.

### The Markdown twins carry their own canonical

`.md` responses are not HTML and are not covered here. They get
`Link: <…>; rel="canonical"` from `_headers` rules that live in
`MarketDataApp/www-marketdata-app`. See CLAUDE.md for why those rules unset
before they set.

## The 404 page

**It names no URL of its own, and it says `noindex`.**

Docusaurus emits a page's own URL four times — `rel=canonical`, `og:url` and
the two `hreflang` alternates — and on this page all four read
`https://www.marketdata.app/docs/404.html/`. `applyTrailingSlash` adds the
slash and the result is not a route: it 404s. A page that only ever means "not
found" has no preferred URL to declare, and the one it declared was nothing.

`noindex` is the half that stops this being cosmetic. **The 404 page is served
with a `200`.** Cloudflare Pages strips the `.html`, so production answers:

```
/docs/404.html   308 -> /docs/404
/docs/404        200                 the same page, as a success
/docs/404/       308 -> /docs/404
```

That is a soft 404: crawlable, indexable, under a URL that looks like a real
page. The production build sets no robots directive of its own — `noIndex` is
false there — so the page had nothing telling a crawler to leave it alone.
Staging already emits `noindex, nofollow` on every page, so the tag is only
ever *added* where it is missing and the two arms end up agreeing.

`plugins/not-found-head.js` makes both true in `postBuild`, by cutting the four
tags out of `build/404.html` and appending a robots meta. It works on the
artefact rather than on the theme because the tags come from
`@theme/SiteMetadata`, which takes no props from the route and offers no hook;
the alternative was a permanent swizzled copy of a core internal. See
[SEO-GAPS.md](./SEO-GAPS.md#the-404s-canonical-l1--fixed-no-longer-a-gap).

*Gated by rules L1 (no self-naming URL), L2 (`noindex`) and L3 (absent from the
sitemap).*

L3 was true before it was asserted: `@docusaurus/plugin-sitemap` excludes the
404 on its own, so the property held because of how a plugin happens to behave
and nothing stated it. That is the shape this file keeps closing. It matters
more than a stray line would, because L2 exists precisely for the fact that
Pages serves this page at `/docs/404` with a `200` — a sitemap entry would be
an instruction to crawl a soft 404. All four spellings are checked, since an
entry could only ever appear by a route other than the expected one.

## `<meta name="robots">` and the sitemap

**These are two halves of one statement and must agree exactly.** A page the
sitemap advertises must not say `noindex`; a page that says `noindex` must not
be advertised. Checked in both directions, because neither half can see the
other and each is separately editable.

An absence assertion is as load-bearing as a presence one. Every run prints
both totals; they are deliberately not written down here, because they differ
between the two environments and a number in prose is the one thing on this
page nothing keeps true.

*Gated by rule D2.*

### The `/internal/` section

`/docs/internal/` holds our own reference material. It is absent from the
navbar and reachable by typing the URL, and **every page in it is `noindex`.**

The directive is not front matter. `plugins/internal-head.js` stamps it onto
the built pages, because the two obvious spellings are both wrong here:

- `unlisted: true` marks a page `noindex` **and** drops it from the sidebar in
  a production build, which removes the one thing the section exists to give.
  It stays correct for `sdk/sdk-requirements`, a lone page that shows no
  sidebar on purpose.
- a `<head>` block in the MDX is documented to work and **does not work in this
  build**. It renders as literal text, reaches the Markdown twin verbatim, and
  produces no tag — so the source looks annotated while the page is fully
  indexable.

Three things then follow from that one tag, and one deliberately does not:

| Consumer                      | Reads                                                |
|-------------------------------|------------------------------------------------------|
| crawlers, including Algolia's | the rendered tag                                     |
| `lint:seo` M1                 | the rendered tag                                     |
| the sitemap                   | `ignorePatterns` in `docusaurus.config.js`, by route |
| `llms.txt`                    | **the stem**, in `lib/llms-txt.js` — not the tag     |

`llms.txt` is the exception because Docusaurus runs postBuild hooks with
`Promise.all`. Whether the llms.txt pass reads a stamped page is a race, so the
section is excluded by stem, which is decided before any hook runs.

*Gated by rules M1 and D2.* M1 fails a page under `/internal/` that carries no
`noindex`; D2 then fails the same page from the other direction, because an
indexable route the sitemap does not advertise is itself a contradiction. Both
were confirmed to fire by deleting the tag from a built page.

## Headings

Exactly one `<h1>` per page. Docusaurus renders it from frontmatter `title`
when the body has no top-level heading.

Every page's outline descends one level at a time: no `<h2>` is followed by
an `<h4>`, and nothing under the `<h1>` starts at `<h3>`.

*Gated by rules E1 and D3.*

## Structured data

Doc pages carry one JSON-LD `TechArticle`, written by
`src/theme/DocItem/MarkdownActions/`. It parses, its `url` equals the
canonical, and its `dateModified` equals both `article:modified_time` and the
`<time datetime>` the row renders.

`dateModified` comes from git via `showLastUpdateTime`, which needs
`fetch-depth: 0` at build time. Under a shallow clone every page reports the
same date and nothing says so.

*Gated by rule F1. The date's per-page correctness is covered by
`e2e/markdown-actions.spec.js`, which asserts two pages differ.*

---

## What gates what

| Feature                                                       | Gated by                   | Where it runs             |
|---------------------------------------------------------------|----------------------------|---------------------------|
| one `<title>`, with text, more than the site name             | `lint:seo` A1              | against `build/`          |
| `lang`, exactly one charset, a viewport                       | `lint:seo` A2              | against `build/`          |
| every content page has a description                          | `lint:seo` B1              | against `build/`          |
| exactly one canonical per route                               | `lint:seo` C1              | against `build/`          |
| the canonical is absolute and names this page, with its slash | `lint:seo` C2              | against `build/`          |
| `og:url` and `og:description` agree with their sources        | `lint:seo` C3              | against `build/`          |
| the build resolves to one known environment                   | `lint:seo` D0              | against `build/`          |
| every staging page is `noindex`                               | `lint:seo` D1              | against `build/`          |
| every `/internal/` page is `noindex`                          | `lint:seo` M1              | against `build/`          |
| the `/internal/` pages are stamped so M1 is true              | `internal-head` postBuild  | during the build          |
| robots and the sitemap agree, in both directions              | `lint:seo` D2              | against `build/`          |
| exactly one `<h1>`                                            | `lint:seo` E1              | against `build/`          |
| no page skips a heading level                                 | `lint:seo` D3              | against `build/`          |
| a page promising a large card declares an image               | `lint:seo` F2              | against `build/`          |
| the 404 names no URL of its own                               | `lint:seo` L1              | against `build/`          |
| the 404 says `noindex`                                        | `lint:seo` L2              | against `build/`          |
| the sitemap does not advertise the 404                        | `lint:seo` L3              | against `build/`          |
| the 404's head is rewritten to make L1 and L2 true            | `not-found-head` postBuild | during the build          |
| every built page's Markdown twin is still in the build        | `lint:seo` G1              | against `build/`          |
| JSON-LD parses and agrees with the head around it             | `lint:seo` F1              | against `build/`          |
| the sitemap lists only pages that built                       | `lint:sitemap`             | against `build/`          |
| every sitemap URL is served                                   | `test:sitemap`             | against the deployed site |
| every route has a Markdown twin                               | `markdown-twins` postBuild | during the build          |
| internal link targets exist                                   | `lint:links`               | during the build          |
| the actions row, its date and its metadata                    | `test:e2e`                 | against the deployed site |

One coverage difference is deliberate: `e2e/markdown-actions.spec.js` checks
the structured data on **two** pages in a real browser; `lint:seo` F1 checks it
on **all 270** in the artefact. The e2e test can see what a browser computes;
the linter can see every page. Neither replaces the other.

---

## Reported, never gated

A rule listed here counts and names every offending page on every run. None is
a count baseline — the list can only be paid down, never quietly grown.
Flipping the named flag in `scripts/lint-seo.js` is the whole change once
clean.

<!-- lint:seo S1 gates the counts in this table. Do not edit them by hand;
     run `node scripts/lint-seo.js` and copy what it reports. -->

| Rule | Backlog | What it is | Flag |
|------|---------|------------|------|

**The table is empty, and the header stays.** Every rule is gated: `H1`, `H2`,
`I1`, `I2`, `I3`, `F2`, `D3` and finally `L1` were each measured, paid down and
turned on. A header with no rows under it is the correct end state and rule S1
reads it as zero declared rows.

Deleting the header would break the build rather than tidying it. S1 finds the
table by that header and **fails closed** when it cannot — the alternative is a
parser that compares an empty table against an empty expectation and passes
forever while gating nothing. Add a row here the moment a rule goes back to
being reported.

### Why those numbers are gated too

**A count in prose is the one thing on the page nothing keeps true.** The
sibling spec in `MarketDataApp/website` said "101 of 101" in six places while
its own check reported 127 pages — wrong by 26 for weeks, in the document that
is supposed to be the statement of intent the check gates against. Its
`lint:doc-refs` gates every `path:line` citation in that file and has nothing
to say about a number beside one.

So rule **S1** parses the table above and asserts every row equals what this
run measured. Pay ten offenders off a row and the check fails until that row
says ten fewer — the backlog can only be paid down on purpose. It also
fails when a rule goes clean and its row survives, which is how the H2, I2 and
I3 rows were caught the moment the descriptions landed, and the D3 row the
moment the outlines were fixed.

S1 finds the table by its header row, not by matching a rule-shaped line
anywhere in the file, and **fails closed when it cannot find it**: delete or
rename the table and the check says so, rather than comparing an empty table
against an empty expectation and passing forever while gating nothing. The
header is matched cell by cell after trimming rather than as an exact string,
because this repo's pre-commit hook re-aligns every table on every commit.

**These counts describe the PRODUCTION build**, which is the one crawlers are
served, and S1 only runs against that arm. Two things differ on staging and
would make a single table wrong for one of them: the `sitemap` and `robots`
totals by design, and — less obviously — `I1`, because `siteConfig.title` is
`Market Data Docs (staging)` there, so the suffix Docusaurus appends to every
title is 15 characters longer. The first version of S1 assumed every count was
environment-independent and its own staging run proved otherwise.

`I1` no longer differs between the arms, and gating it is what forced the
issue. `LENGTH_ENFORCED` turned a difference S1 could route around into a
failure nothing could: the same authored titles measured 0 on production and
10 on staging, so an ordinary `yarn build` — CI always passes `PROD=true` —
failed on ten titles whose extra characters are all in the suffix.

**I1's budget now moves with the suffix.** Staging measures against
`60 + 15`, which is the same 60 characters of authored title as production,
and three self-tests hold the equivalence in both directions: a 47-character
title fails on either arm, a 46-character one passes on either.

**H1 is fixed and now gated.** 270 pages shared 137 distinct titles, because
the SDK and Sheets sections document the same endpoints and so repeat the API
section's page names — `Candles | Market Data` was served by twelve pages and
`Quotes | Market Data` by eleven. Google treats duplicate titles as a signal
that the pages are duplicates.

The convention that resolved it keeps the API section unqualified, because it
is the canonical reference, and names the section that owns every other copy:
`Candles (Python SDK)`, `Authentication (Sheets)`,
`Troubleshooting (Account)`. Where a section collided with itself the subject
disambiguates instead of the section, so a language SDK's two candle pages
became `Fund Candles (Go SDK)` and `Stock Candles (Go SDK)`.

**Every retitled page also gained a `sidebar_label`.** `sidebars.js` is
`{type: "autogenerated"}`, so `title:` is the sidebar label, the breadcrumb,
the pagination link and the `DocCard` heading as well as the `<title>` and the
`<h1>`. Carrying the old short title in `sidebar_label` lets the head grow
without moving anything a reader navigates by; all 5,067 sidebar links, 510
pagination links, 300 breadcrumbs and 122 cards read exactly as they did.

Two pages had no frontmatter to fix: the tag indexes at `/api/tags/` and
`/sheets/tags/` are generated, and `plugin-content-docs` titles every instance
with one translation string, "Tags". `src/theme/DocTagsListPage` names each one
after its own section, reading the instance id back from the route.

`I1` went with it. Its single offender was
`/sheets/troubleshooting/extension-disabled/` at 61 characters, whose title
ended in "When Using Market Data" — a phrase the `| Market Data` suffix already
supplies.

**F2 is fixed and now gated.** It was the sharpest finding of the first run:
every page stated `twitter:card=summary_large_image` and no page declared
`og:image`, so a link shared anywhere that reads Open Graph rendered as a bare
URL. The promise is emitted unconditionally by Docusaurus; the image needed one
config key that was never set. `themeConfig.image` now supplies a 1200×630 card
and `CARD_IMAGE_ENFORCED` is `true`, so the two cannot come apart again.

**L1 is fixed and now gated, and it was the last one.** It was carried as
measured-not-gated on the argument that the page only ever answers 404, so a
crawler drops the response before it reads `rel=canonical` and nothing sees the
tag. Measured against production on 2026-09-03, the argument was false:
Cloudflare Pages strips the `.html`, `/docs/404.html` 308s to `/docs/404`, and
that answers **200**. A soft 404, crawlable, carrying a canonical to a URL that
404s — which is exactly the trigger the gap note itself had named for flipping
the flag.

The fix works on the artefact and not on the theme, because the tags come from
`@theme/SiteMetadata` and it takes no props from the route: see
[The 404 page](#the-404-page). `L2` came with it, and is the half that mattered
most — a page served 200 with no robots directive.

**How the reporting machinery stays proven now that nothing reports.** Four
self-tests used to stand on whichever rule was still red, and each was
rewritten when that rule went green — duplicate titles, then duplicate
descriptions, then skipped headings, then this. There is no fifth rule to move
them to, and a reporting path nothing exercises is a reporting path that can
stop working silently.

`scripts/lint-seo.js --ungate <rule>` reports a gated rule instead of failing
on it, for one run. The self-tests construct the condition with it rather than
borrowing a real backlog: a fixture that violates `L1` proves the REPORTED
block prints and leaves the exit code alone, fifteen `D3` offenders prove it
truncates at three and that `--report` shows them all, and the two S1 tests
that need a real count put the canonical back into `build/404.html` and read it
off the shipped artefact. The flag changes no rule's verdict, only whether that
verdict is fatal; it announces itself in the run header, and nothing in CI
passes it.

**H2, I2 and I3 are fixed and now gated.** All three had one cause: almost no
page set a `description:`, so Docusaurus derived one from the first paragraph.
That is why eight account troubleshooting pages and one Sheets page all
described themselves as `Problem Overview`, and why 107 descriptions ran past
160 characters — the longest, `/account/upgrades/`, was 493. 165 pages now
carry a hand-written description of 70 to 160 characters.

The six language SDKs document the same endpoints, so a description written
for the endpoint alone collides the way the titles did. **Every SDK
description names its language**, which makes the collision impossible rather
than merely unlikely: "Retrieve news articles for a stock symbol" was served by
four pages, and is now four sentences that each name the C#, Go, Java or PHP
SDK. The same rule separates `/api/stocks/earnings/` from
`/sdk/php/stocks/earnings/`.

Frontmatter is stripped before a page becomes its Markdown twin, so none of
this reaches `build/**/index.md`. `lib/__tests__/mdx-to-md.test.js` holds that,
and it is why the descriptions could be written in bulk at all.

See [SEO-GAPS.md](./SEO-GAPS.md) for what is deliberately not checked at all.
