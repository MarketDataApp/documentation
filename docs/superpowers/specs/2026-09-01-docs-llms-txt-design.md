# /docs/llms.txt — design and cross-repo contract

**Date:** 2026-09-01
**Status:** approved, in implementation
**Repos:** `MarketDataApp/documentation` (generator), `MarketData-App/website`
(root file), `MarketDataApp/www-marketdata-app` (orchestrator)

## Problem

`https://www.marketdata.app/llms.txt` lists 123 entries and **none** of them
links to `/docs/`. The API documentation is 252 content routes and an agent
reading the root file cannot discover that any of it exists.
`https://www.marketdata.app/docs/llms.txt` answers 404.

Recorded in `MarketData-App/website#36`. Note that #36's figures are stale: it
says 97 entries / 24,710 bytes; the live file is 123 entries / 31,285 bytes as
of 2026-09-01. The "zero of them reach `/docs/`" claim is unchanged and
re-verified.

## Shape

Three artifacts, composed at orchestrator merge time:

```
docs build      ->  build/llms.txt          252 entries, categorised
                    build/llms-full.txt     ~1.3 MB, concatenated Markdown
                    (CI nests both under build/docs/)

website build   ->  its own root llms.txt and llms-full.txt, each carrying
                    one marker line, otherwise unchanged

orchestrator    ->  /llms.txt        123 + 252 entries
                    /llms-full.txt   ~1.9 MB
                    /docs/llms.txt   ours, served standalone as well
```

### Why the splice happens at merge time

The orchestrator is the only place both builds exist together. The two
alternatives were rejected for concrete reasons:

- **Website fetches ours over HTTP at its build time.** It would read the
  *previous* docs deploy, so the root file lags a release, and a docs 404
  silently yields a root file with no docs entries.
- **Docs exports JSON for the website to format.** Two artifacts to keep in
  sync, and the website build needs R2 read access it does not have.

Merge-time composition also **preserves the website's existing gates**.
`lint:twins`, `lint:seo` (section G) and `lint:links-http` assert things about
pages that build emits. Because the splice happens after that build, the
website's own `llms.txt` never contains foreign entries, so those checks keep
asserting exactly what they assert today. The verification burden moves to the
orchestrator, which can see both halves.

## Our half — `plugins/llms-txt.js`

A `postBuild` plugin, ordered **after** `./plugins/markdown-twins` in
`docusaurus.config.js`.

**Metadata.** Title and description come from the built HTML. Only 2 of 259
source files carry a frontmatter `description`, but Docusaurus synthesises
`<meta name="description">` from the first paragraph, so all 252 routes have
one with no authoring work.

**Links** point at the `.md` twin, matching the root file's convention.

**Categories** derive from the route prefix:

| Prefix        | Section             | Routes |
|---------------|---------------------|--------|
| `api/`        | API                 | 53     |
| `sdk/<lang>/` | SDKs > per language | 141    |
| `sheets/`     | Google Sheets       | 28     |
| `account/`    | Account & Policies  | 36     |

**Excluded from the index:** the 7 tag pages, `/search` and the 404 — 9
navigation artifacts with no content. They still receive Markdown twins;
`markdown-twins` fails the build if any route lacks one. The index list and the
twin list are deliberately different.

**Full text** is read from the twins `markdown-twins` wrote earlier in the same
`postBuild` pass. The plugin asserts every expected twin exists, so the ordering
dependency fails loudly rather than emitting a quietly empty file.

**Staging.** Both hosts publish. `llms.txt` is not a crawler artifact, so the
`noIndex` rule that suppresses the sitemap does not apply. Staging's file will
list Go v2 URLs, which is correct there and cannot happen on main, because those
routes do not exist in a main build. No branch special-casing.

## The contract

The website's root `llms.txt` and `llms-full.txt` each carry exactly one marker
line:

```
<!-- docs:llms -->
```

The orchestrator replaces that line with the body of the corresponding docs
file, taken from `sources/docs/llms.txt` and `sources/docs/llms-full.txt`.

**Both failure modes must fail the deploy, not degrade silently:**

1. the marker is absent from a root file;
2. `sources/docs/llms.txt` or `sources/docs/llms-full.txt` is missing.

A root file that quietly loses 252 entries is the same class of defect this
group has already paid for twice — a check that stops covering most of what it
names, while still passing.

## Testing

- Unit tests for categorisation and entry formatting, under the existing
  `yarn test:lib` harness.
- A build-time assertion that every indexed route resolves to a twin.
- An integration test that `/docs/llms.txt` serves 200 and every URL it lists
  does too, modelled on `tests/sitemap.integration.test.js`.

## Ownership

| Half                         | Owner |
|------------------------------|-------|
| `plugins/llms-txt.js`        | ether |
| root file, markers, #36 work | raven |
| orchestrator splice          | focus |
