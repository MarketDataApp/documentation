# What the SEO check deliberately does not gate

Companion to [SEO.md](./SEO.md). Without this list every gap reads as an
oversight, and somebody re-derives the same decision every few months.

Two kinds of entry: rules that are **measured but not enforced** (the backlog
is real and the flag is ready), and ground that is **not checked at all**
(with the reason).

---

## Measured, not enforced

These are listed in SEO.md's [Reported, never gated](./SEO.md#reported-never-gated)
table with their flags. What follows is why each is not simply fixed.

### The 404's canonical (L1)

Every 404 response declares:

```
<link rel="canonical" href="https://www.marketdata.app/docs/404.html/">
```

That URL 404s. `applyTrailingSlash` appends `/` to `/docs/404.html`, and the
result is not a route.

**Measured, not gated, and not fixed.** The page is served with a real `404`
status — verified against production — and a crawler drops a 404 before it
processes `rel=canonical`, so the hint is never read. Suppressing it means
swizzling `@theme/SiteMetadata`, a core Docusaurus internal that also emits
`og:url`, the `hreflang` alternates and the search metadata, and then carrying
that copy across every Docusaurus upgrade. That is a standing maintenance cost
for a tag nothing reads.

**Flip `NOT_FOUND_CANONICAL_ENFORCED` if the 404 ever starts answering 200.**
A soft 404 *is* crawled, and then the canonical is read and points at nothing.

### Title and description length (I1–I3)

Docusaurus derives a description from the page's first paragraph when the
frontmatter sets none. The pages outside the budget are outside it because of
that default, not because their authors were careless — enforcing it means
writing a frontmatter description for every one of them. SEO.md's gated table
holds the current count; this sentence deliberately does not restate it.

### The card image (F2) — fixed, no longer a gap

Kept here as the record of what the entry said and how it ended. It read: "not
fixed because both fixes are product decisions — a default `og:image` needs a
designed asset, and dropping `summary_large_image` changes how every shared
link looks."

The asset was the blocker and the owner supplied it: a 1200×630 crop of the
brand Social Media Kit's Facebook cover. `themeConfig.image` covers all 270
pages, per-page `image:` frontmatter overrides it, and F2 is gated.

The reason it is worth a paragraph rather than a deletion: it is the clearest
case so far of "reported, never gated" working as intended. The rule could not
be green for weeks, so it counted and named 270 pages on every run instead of
being dropped — and when the one missing input arrived, the fix was one config
key and a flag.

---

## Not checked at all

### The narrative counts outside the backlog table

Rule S1 gates the backlog table in SEO.md, and only that table. Sentences
elsewhere in these two documents that quote a number are not parsed, so they
can still rot.

That is a real gap and it is bounded on purpose: parsing arbitrary prose for
integers would fail on "160 characters" and "one h1" and every other number
that is a threshold rather than a measurement. The mitigation is editorial —
counts that change live in the gated table, and the prose points at it rather
than restating it.

The environment totals (`sitemap` URLs, `noindex` pages) are deliberately
absent from both documents: they differ between production and staging, so
every run prints them and nothing writes them down.

### Anything about ranking

No check here asserts that a page ranks, that a keyword appears, or that
content is "good". Those are not properties of an artefact and a linter that
claimed to measure them would be lying.

### `robots.txt`

`/docs/robots.txt` 404s, deliberately — the build writes none, and the zone's
`robots.txt` at the apex covers the host. That is recorded in CLAUDE.md.
Nothing here asserts its contents, because the file belongs to
`MarketDataApp/www-marketdata-app` and this repo cannot see it at build time.

### The `.md` twins' canonical header

`Link: <…>; rel="canonical"` on Markdown responses comes from `_headers` rules
in the orchestrator repo. This check reads `build/`, where those rules do not
exist yet — they are merged at deploy time. Asserting them here would mean
asserting a file this repo does not write.

**It is checked, just not here.** `headers.test.mjs` in
`MarketDataApp/www-marketdata-app` covers the unset-before-set ordering that
keeps a page from serving two canonicals.

### hreflang

Every page emits `en` and `x-default` alternates pointing at itself. The site
has one locale, so the tags are correct and inert. Nothing asserts them because
there is no second locale for them to be wrong about; revisit when there is.

### Image `alt` text

Not asserted. There is no `lint:html` in this repo, so unlike the marketing
site there is no existing check to defer to — this is a genuine gap rather than
a delegation, and it is the most likely next rule.

### Open Graph beyond the four tags checked

`og:title`, `og:description`, `og:url` and `og:image` are read. `og:type`,
`og:site_name` and `og:locale` are emitted by Docusaurus, are constant across
the corpus, and would only ever fail all-or-nothing on a Docusaurus upgrade —
which the four checked tags would also catch.

### Word count and thin pages

The marketing site's `lint:sitemap` requires 500 characters of body text per
page. Not carried over: API reference pages are legitimately terse, and several
are mostly a code fence and a parameter table. A floor tuned for prose would
fail pages that are correct.

### Performance, Core Web Vitals, CLS

Not an artefact property. The marketing repo gates CLS against a running
server; this repo has no equivalent harness and adding one is a separate piece
of work.

### Structured data beyond our own block

`lint:seo` F1 checks the `TechArticle` this repo writes. It does not validate
the graph against schema.org, and there is no `lint:schema` here. If more
structured data is added — `BreadcrumbList` is the obvious next one — that gap
becomes worth closing.

---

## Why this is a separate check from the marketing site's

The two repos each run their own, by the owner's decision. A shared package
would either fail on one build for reasons that are not defects, or be watered
down until it gated nothing.

Concretely, of the marketing check's rules: its `C4` parses that repo's
workflow files, `C3`/`C5` encode robots strings and a Zaraz loader URL that
Docusaurus never emits, its `lint:sitemap` compares against `astro.config.mjs`,
and its brand rule, length budgets and card conventions are decisions rather
than SEO law. What transferred is the *shape*: gate the artefact, assert
absence as well as presence, write the spec as prose, and name the backlog on
every run.
