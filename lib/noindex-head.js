'use strict';

/**
 * Two head rules about pages that must not be indexed, applied in one pass.
 *
 *   1. Every page under `/internal/` says `noindex, nofollow`.
 *   2. **A page that says `noindex` emits no canonical.**
 *
 * ---------------------------------------------------------------------------
 * WHY THE TWO RULES SHARE ONE MODULE AND ONE PASS
 * ---------------------------------------------------------------------------
 *
 * Rule 2 has to know whether a page says `noindex`, and for `/internal/` that
 * is only true after rule 1 has run. Docusaurus executes postBuild hooks with
 * `Promise.all`, so two plugins would race: whether the canonical pass reads a
 * stamped page or an unstamped one would depend on the machine. One
 * read-modify-write per file removes the race instead of narrowing it.
 *
 * ---------------------------------------------------------------------------
 * RULE 1: WHY A BUILD STEP AND NOT FRONT MATTER
 * ---------------------------------------------------------------------------
 *
 * `unlisted: true` marks a page noindex AND removes it from the sidebar in a
 * production build. That defeats what the `/internal/` section exists for:
 * land on a page by typing its URL and get the section's menu. It was how
 * `sdk-requirements` hid before it moved into this section, alongside
 * `displayed_sidebar: null`; both came off in the move.
 *
 * A `<head>` block in the MDX is documented to work and does not work here.
 * Written into `internal/seo-requirements.mdx` it rendered as literal text --
 * it reached the Markdown twin verbatim and produced no tag in the built HTML.
 * **Measured, not assumed**: the built page's only `<meta name>` tags were
 * `generator` and `algolia-site-verification`.
 *
 * ---------------------------------------------------------------------------
 * RULE 2: THE RULING, AND HOW BIG IT IS HERE
 * ---------------------------------------------------------------------------
 *
 * Google's guidance is that `rel="canonical"` and `noindex` must not be
 * combined: one page would be indexable while the other is explicitly blocked.
 * `MarketDataApp/website` ruled on it (SEO-DECISIONS #15, "we need to drop the
 * cannonical tag all together on the staging site") and enforces it through
 * `emitsCanonical()`.
 *
 * This site did not, and the gap was not four pages -- it was every page on
 * staging. `noIndex: process.env.PROD !== "true"` marks the whole staging
 * build `noindex`, and every one of those pages was also emitting a canonical
 * pointing at `www-staging.marketdata.app` -- asking Google to index a host
 * nobody should ever index, on a page that says not to. Measured live on
 * 2026-09-04.
 *
 * On production it is the `noindex` pages: `account/plans/commercial` and the
 * `/internal/` section.
 *
 * **Only the canonical is removed.** `og:url` and the JSON-LD `@id` stay, on
 * every page, in both environments -- Open Graph is not a search directive and
 * `@id` is an identifier rather than an indexing preference. That is the same
 * line the website's ruling draws.
 *
 * `404.html` is NOT handled here. `lib/not-found-head.js` owns that page and
 * strips more from it, so leaving it out keeps two concurrent hooks off one
 * file. Its rules are gated separately by `lint:seo` L1 and L2.
 */

const { voidTags } = require('./not-found-head');

/** The directive, and the only place its text is written. */
const ROBOTS = '<meta name="robots" content="noindex, nofollow">';

const HEAD_OPEN = /<head\b[^>]*>/i;
const HEAD_CLOSE = '</head>';

/** The head's inner bounds, or an error -- never a silent pass-through. */
function headBounds(html) {
  const open = HEAD_OPEN.exec(html);
  const close = html.toLowerCase().indexOf(HEAD_CLOSE);
  if (!open || close === -1 || close < open.index) {
    throw new Error('no <head>…</head> to rewrite');
  }
  return { from: open.index + open[0].length, to: close };
}

/** True when this head already carries a robots directive saying noindex. */
function saysNoindex(head) {
  return voidTags(head).some(
    (t) => t.name === 'meta' && t.attrs.name?.toLowerCase() === 'robots' && /noindex/i.test(t.attrs.content ?? '')
  );
}

/** True when this head carries any robots directive at all. */
function hasRobots(head) {
  return voidTags(head).some((t) => t.name === 'meta' && t.attrs.name?.toLowerCase() === 'robots');
}

/**
 * Apply both rules to one built page.
 *
 * `internal` marks a page under `/internal/`, which gets the directive added.
 * Every page then loses its canonical if -- after that -- it says `noindex`.
 */
function applyHeadRules(html, { internal = false } = {}) {
  const { from, to } = headBounds(html);
  let head = html.slice(from, to);

  // --- Rule 1 -------------------------------------------------------------
  // Appended, not prepended: `<meta charset>` has to appear in the first 1024
  // bytes and Docusaurus writes it first. A page that already carries a robots
  // tag is left alone -- on staging every page does, and a second tag would
  // not override the first. react-helmet-async renders both.
  let addedNoindex = false;
  if (internal && !hasRobots(head)) {
    head += ROBOTS;
    addedNoindex = true;
  }

  // --- Rule 2 -------------------------------------------------------------
  let strippedCanonical = 0;
  if (saysNoindex(head)) {
    const doomed = voidTags(head).filter((t) => t.name === 'link' && t.attrs.rel?.toLowerCase() === 'canonical');
    // Back to front, so an earlier cut cannot move a later tag's offsets.
    for (const tag of [...doomed].reverse()) {
      head = head.slice(0, tag.start) + head.slice(tag.end);
    }
    strippedCanonical = doomed.length;
  }

  return {
    html: html.slice(0, from) + head + html.slice(to),
    addedNoindex,
    strippedCanonical,
    changed: addedNoindex || strippedCanonical > 0,
  };
}

module.exports = { applyHeadRules, ROBOTS };
