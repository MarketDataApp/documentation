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

*Gated by rule A1.* Uniqueness and length are **reported, not gated** — see
below.

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

| Rule | Backlog | What it is                                 | Flag                           |
|------|---------|--------------------------------------------|--------------------------------|
| H1   | 33      | titles used by more than one page          | `TITLE_UNIQUE_ENFORCED`        |
| H2   | 12      | descriptions used by more than one page    | `DESC_UNIQUE_ENFORCED`         |
| I1   | 1       | titles over 60 characters                  | `LENGTH_ENFORCED`              |
| I2   | 107     | descriptions over 160 characters           | `LENGTH_ENFORCED`              |
| I3   | 45      | descriptions under 70 characters           | `LENGTH_ENFORCED`              |
| F2   | 270     | pages promising a large card with no image | `CARD_IMAGE_ENFORCED`          |
| D3   | 89      | pages skipping a heading level             | `HEADING_ORDER_ENFORCED`       |
| L1   | 1       | the 404's canonical                        | `NOT_FOUND_CANONICAL_ENFORCED` |

### Why those numbers are gated too

**A count in prose is the one thing on the page nothing keeps true.** The
sibling spec in `MarketDataApp/website` said "101 of 101" in six places while
its own check reported 127 pages — wrong by 26 for weeks, in the document that
is supposed to be the statement of intent the check gates against. Its
`lint:doc-refs` gates every `path:line` citation in that file and has nothing
to say about a number beside one.

So rule **S1** parses the table above and asserts every row equals what this
run measured. Fix ten titles and the check fails until the table says 23 — the
backlog can only be paid down on purpose.

**These counts describe the PRODUCTION build**, which is the one crawlers are
served, and S1 only runs against that arm. Two things differ on staging and
would make a single table wrong for one of them: the `sitemap` and `robots`
totals by design, and — less obviously — `I1`, because `siteConfig.title` is
`Market Data Docs (staging)` there, so the suffix Docusaurus appends to every
title is 15 characters longer and ten more titles cross 60. The first version
of S1 assumed every count was environment-independent and its own staging run
proved otherwise.

**H1 is the one worth acting on first.** Far fewer distinct titles than pages,
because the SDK sections repeat the API section's page names — `Candles |
Market Data` is the worst offender. Google treats duplicate titles as a signal
that pages are duplicates, and this is the classic Docusaurus failure. The fix
is a title convention that names the section (`Candles (Python SDK) | Market
Data`), which is a content decision rather than a lint fix. Run the check for
the current spread; it prints distinct titles against page count on every run.

**F2 is a real defect, not a nicety.** Every page states
`twitter:card=summary_large_image` and no page declares `og:image`, so a link
shared anywhere that reads Open Graph renders as a bare URL. One template
change covers the whole corpus. Two ways out: declare a default `og:image`, or
stop promising a large card. Both are product decisions.

See [SEO-GAPS.md](./SEO-GAPS.md) for what is deliberately not checked at all.
