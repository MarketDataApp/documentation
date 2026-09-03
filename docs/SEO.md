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

*Gated by rule A1 (presence) and rule H1 (uniqueness).* Length is **reported,
not gated** — see below.

## `<meta name="description">`

Every content page has one. Navigation artifacts — the tag pages and the search
UI — do not, and are exempt.

**The exemption reuses `isNavigationArtifact()` from `lib/llms-txt.js`.** That
function already answers "is this route content, or scaffolding?" for the
`llms.txt` index. A second list here would be a second answer to one question,
and the two would drift.

Docusaurus derives the description from the page's first paragraph when the
frontmatter does not set one. That is why some are a bare heading
(`"Problem Overview"`) and why so many exceed 160 characters — see rules I2 and
I3 below for the current count. It is a systemic default, not per-page
carelessness.

*Gated by rule B1 (presence). Uniqueness and length are reported.*

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

## Headings

Exactly one `<h1>` per page. Docusaurus renders it from frontmatter `title`
when the body has no top-level heading.

*Gated by rule E1.* Heading-level skips are reported.

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
| robots and the sitemap agree, in both directions              | `lint:seo` D2              | against `build/`          |
| exactly one `<h1>`                                            | `lint:seo` E1              | against `build/`          |
| a page promising a large card declares an image               | `lint:seo` F2              | against `build/`          |
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

Each of these counts and names every offending page on every run. None is a
count baseline — the list can only be paid down, never quietly grown. Flipping
the named flag in `scripts/lint-seo.js` is the whole change once clean.

<!-- lint:seo S1 gates the counts in this table. Do not edit them by hand;
     run `node scripts/lint-seo.js` and copy what it reports. -->

| Rule | Backlog | What it is                              | Flag                           |
|------|---------|-----------------------------------------|--------------------------------|
| H2   | 12      | descriptions used by more than one page | `DESC_UNIQUE_ENFORCED`         |
| I2   | 107     | descriptions over 160 characters        | `LENGTH_ENFORCED`              |
| I3   | 44      | descriptions under 70 characters        | `LENGTH_ENFORCED`              |
| D3   | 89      | pages skipping a heading level          | `HEADING_ORDER_ENFORCED`       |
| L1   | 1       | the 404's canonical                     | `NOT_FOUND_CANONICAL_ENFORCED` |

### Why those numbers are gated too

**A count in prose is the one thing on the page nothing keeps true.** The
sibling spec in `MarketDataApp/website` said "101 of 101" in six places while
its own check reported 127 pages — wrong by 26 for weeks, in the document that
is supposed to be the statement of intent the check gates against. Its
`lint:doc-refs` gates every `path:line` citation in that file and has nothing
to say about a number beside one.

So rule **S1** parses the table above and asserts every row equals what this
run measured. Write ten frontmatter descriptions and the check fails until the
table says 97 — the backlog can only be paid down on purpose.

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

`I1` is why that matters more now than it did: production measures 0 and has
no row, while the same corpus measures 6 on staging. A table gating both arms
would have to be wrong for one of them.

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

See [SEO-GAPS.md](./SEO-GAPS.md) for what is deliberately not checked at all.
