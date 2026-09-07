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

**Metadata.** Titles come from the Markdown twin's first heading; descriptions
come from the built HTML. Only 2 of 259 source files carried a frontmatter
`description`, but Docusaurus synthesises `<meta name="description">` from the
first paragraph, so 248 of 252 routes had one with no authoring work.

The remaining four were the docs root and the three generated Sheets category
indexes, which have no first paragraph to synthesise from. They are exactly the
pages an agent uses to orient, so they were given real descriptions rather than
left blank: three in frontmatter, one in the root page's `Layout`. All 252 now
carry one.

Titles deliberately do NOT come from the built page's `<title>`, which carries a
" | Market Data" suffix. That is also why this repo needs no suffix-stripping
rule, and why the same shortcut does not transfer to the website repo: their
`<h1>` is a marketing headline rather than a page name, so their titles must
come from `<title>` and be stripped.

**Disambiguation.** The 252 entries carry only 130 distinct titles, because
every SDK documents the same endpoints. Most repeats are separated by their
headings, but 14 collide *within* one section -- funds and stocks both have
"Candles" under a single language, and universal-parameters and utilities both
have "Headers" under API. Those are qualified with their parent segment, giving
"Candles (Funds)" and "Candles (Stocks)". Only collisions are qualified;
qualifying every title would cost every reader a parenthesis to pay for 14
cases.

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
file, taken from **`sources/docs/docs/llms.txt`** and
**`sources/docs/docs/llms-full.txt`**. The doubled segment is correct and is
not a typo.

`deploy-docs.yml`'s "Restructure build output" step moves everything Docusaurus
emitted under `build/docs/`, lifting only `404.html` and `_headers` to the build
root, and then syncs the whole of `build/` to `{env}/sources/docs/`. Both levels
are visible in the merge log: `sources/docs/_headers` (lifted) beside
`sources/docs/docs/_redirects` (Docusaurus output).

**The files must stay nested. Do not lift a copy to `sources/docs/llms.txt`,**
for two reasons:

1. The nested file is the same file served at `/docs/llms.txt`, so the
   standalone artifact and the splice source cannot disagree. A lifted copy is
   a second artifact that can drift from the first.
2. A root-level `sources/docs/llms.txt` would collide with the website's root
   `llms.txt` during the merge. The merge runs `rsync -a sources/docs/ build/`
   then `rsync -a sources/website/ build/` in alphabetical order, so `website`
   sorts last and would overwrite ours **with no error** — the last-write-wins
   hazard that `_headers` and `_redirects` are hand-concatenated to avoid.

**Both failure modes must fail the deploy, not degrade silently:**

1. the marker is absent from a root file;
2. `sources/docs/docs/llms.txt` or `sources/docs/docs/llms-full.txt` is
   missing. Doubled, as above.

A root file that quietly loses 252 entries is the same class of defect this
group has already paid for twice — a check that stops covering most of what it
names, while still passing.

## The composed file's second H1

The standalone `/docs/llms.txt` opens with `# Market Data Documentation`, which
it needs -- it is served on its own. Once spliced into the root file, that
becomes a second H1 halfway down a document that already has one. The llms.txt
convention is a single H1 naming the project, so a parser splitting on H1 sees
two documents or takes the wrong title.

**Resolved in the splice**: the orchestrator demotes the docs body's single
leading H1 to an H2 during composition, fails if the body carries more than one
H1, and logs that it did so. The standalone artifact stays correct, the composed
file becomes correct, and the only component that knows the body is being
embedded rather than served is the one doing the embedding.

The alternative -- emitting an H2 from this repo -- was rejected because it
fixes the composed file by breaking the standalone one. This tension is inherent
to serving one artifact two ways, which remains the right trade: a single file
cannot drift from itself.

## Testing

- Unit tests for categorisation and entry formatting, under the existing
  `pnpm run test:lib` harness.
- A build-time assertion that every indexed route resolves to a twin.
- An integration test that `/docs/llms.txt` serves 200 and every URL it lists
  does too, modelled on `tests/sitemap.integration.test.js`.

## Ownership

| Half                         | Owner |
|------------------------------|-------|
| `plugins/llms-txt.js`        | ether |
| root file, markers, #36 work | raven |
| orchestrator splice          | focus |
