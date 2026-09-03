# What the SEO check deliberately does not gate

Companion to [SEO.md](./SEO.md). Without this list every gap reads as an
oversight, and somebody re-derives the same decision every few months.

Two kinds of entry: rules that were **measured but not enforced** — every one
of which is now fixed and gated, kept here as the record of how it ended — and
ground that is **not checked at all**, with the reason.

---

## Measured, not enforced

**Nothing is, any more.** SEO.md's
[Reported, never gated](./SEO.md#reported-never-gated) table ships with a
header and no rows: every rule that was once measured-not-gated has been paid
down and turned on. The entries below are kept as the record of what each one
said and how it ended, because a deleted entry is how the same decision gets
re-derived from scratch every few months.

### The 404's canonical (L1) — fixed, no longer a gap

**The entry that was here was wrong, and it was wrong about a fact rather than
about a judgement.** It read:

> The page is served with a real `404` status — verified against production —
> and a crawler drops a 404 before it processes `rel=canonical`, so the hint is
> never read. […] **Flip `NOT_FOUND_CANONICAL_ENFORCED` if the 404 ever starts
> answering 200.** A soft 404 *is* crawled, and then the canonical is read and
> points at nothing.

The 404 page already answered 200, and had all along. Measured against
production on 2026-09-03:

```
/docs/404.html   308 -> /docs/404      Cloudflare Pages strips the .html
/docs/404        200                   the 404 page, as a success
/docs/404/       308 -> /docs/404
```

`/docs/404` is a soft 404 — the trigger the entry itself named. What the
original check verified was that an *unknown* URL 404s, which is true and is a
different question from whether this page is reachable any other way. **A
verified fact about one URL was carried as a fact about the page.**

So the exception went, and it took two rules with it. `L1`: the page names no
URL of its own — the canonical, `og:url` and both `hreflang` alternates all
read `/docs/404.html/`, which 404s. `L2`: the page says `noindex`, which is the
half that mattered, because a 200 with no directive is an invitation.

**The swizzle was still the wrong trade, and it was not needed.** The tags do
come from `@theme/SiteMetadata`, which takes no props from the route and offers
no hook, and copying a core internal that also emits `og:title`, the alternates
and the Algolia search metadata into `src/theme/` — then carrying it across
every Docusaurus upgrade — is a standing cost for one tag on one page. Emitting
a competing tag from a later `<Head>` does not work either: react-helmet-async
renders two canonicals rather than letting the second win, which is why rule C1
counts them.

`plugins/not-found-head.js` changes the artefact instead, in `postBuild`, on
one file. It cuts an exact byte range rather than re-serialising a parsed DOM,
so every other byte of the page is untouched by construction, and its scanner
is quoting- and order-agnostic for the reason recorded in `lint-seo.js`. The
write is atomic — `markdown-twins` reads the same `404.html` in its own
`postBuild`, and Docusaurus runs `postBuild` hooks concurrently.

`NOT_FOUND_CANONICAL_ENFORCED` is `true`, and it was the last flag.

### Heading order (D3) — fixed, no longer a gap

89 pages skipped a level. The shape was almost always the same: an `<h2>`
followed straight by an `<h4>`, because `#### Parameters`, `#### Returns` and
`#### Properties` were written as a visual size under a `## methodName` that had
no `###` in between. A handful of pages opened with `### Get Started Quickly`
directly under the frontmatter `<h1>`.

Every one of those was a mis-levelled heading rather than a missing section, so
each subtree moved up one level and nothing was added or deleted. The single
judgement call: `#### Output`, 55 of them, sat inside `<TabItem>` panels
labelling the console output of an example, up to five times on one page.
Promoting those would have put five identical `Output` entries in one
right-hand table of contents and five duplicate anchors on one page. They are
`**Output**` now, so they leave the outline entirely.

`HEADING_ORDER_ENFORCED` is `true`.

### Title and description length (I1–I3) — fixed, no longer a gap

Kept here as the record of what the entry said and how it ended. It read:
"`LENGTH_ENFORCED` is one flag over three rules: the same flag holds I2 and I3,
and those are still a backlog. Gating title length alone means splitting the
flag, which is worth doing when the descriptions are paid down and not before."

The descriptions were paid down instead, so the flag never had to be split.
Docusaurus derived a description from the first paragraph on every page that
set none, which is what put 107 pages over 160 characters and 44 under 70.
165 pages gained a hand-written `description:` in frontmatter, `LENGTH_ENFORCED`
is `true`, and I1, I2 and I3 are gated together as one flag always intended.

### Description uniqueness (H2) — fixed, no longer a gap

Same cause and the same fix. Twelve descriptions were shared by more than one
page, eight of them reading `Problem Overview` because that was the first
heading of eight account troubleshooting pages. Every SDK description now
names its language, which is what keeps six sections documenting the same
endpoints from writing the same sentence. `DESC_UNIQUE_ENFORCED` is `true`.

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
