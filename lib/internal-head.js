'use strict';

/**
 * Stamps `noindex, nofollow` onto a built `/internal/` page.
 *
 * ---------------------------------------------------------------------------
 * WHY A BUILD STEP AND NOT FRONT MATTER
 * ---------------------------------------------------------------------------
 *
 * Two obvious spellings were tried first and both are wrong here.
 *
 * `unlisted: true` marks a page noindex AND removes it from the sidebar in a
 * production build. That defeats the one thing the section exists to give:
 * land on a page by typing its URL and get the section's menu. It is the right
 * front matter for a lone page like `sdk/sdk-requirements`, which shows no
 * sidebar on purpose, and the wrong one for a section.
 *
 * A `<head>` block in the MDX is documented to work and does not work here.
 * Written into `internal/seo-requirements.mdx` it rendered as literal text --
 * it reached the Markdown twin verbatim and produced no tag in the built HTML,
 * which is worse than doing nothing: the page looks annotated in source and is
 * fully indexable in the build. **Measured, not assumed**: the built page's
 * only `<meta name>` tags were `generator` and `algolia-site-verification`.
 *
 * So the change is made where the artefact is, for the same reason and in the
 * same shape as `lib/not-found-head.js`: after the HTML is written, with no
 * swizzle of a core theme internal to carry across upgrades.
 *
 * ---------------------------------------------------------------------------
 * WHAT READS THE TAG
 * ---------------------------------------------------------------------------
 *
 * Google, the Algolia DocSearch crawler (`ignoreNoIndex` is unset, so the
 * default holds), and `lint:seo` M1, which fails the build when a page under
 * `/internal/` reaches the build without it.
 *
 * What deliberately does NOT read it: `llms.txt`. Docusaurus runs postBuild
 * hooks with `Promise.all`, so whether the llms.txt pass reads a stamped page
 * is a race. `internal` is excluded by stem in `lib/llms-txt.js` instead --
 * decided before any hook runs, and unable to lose that race.
 */

/** The directive, and the only place its text is written. */
const ROBOTS = '<meta name="robots" content="noindex, nofollow">';

const HEAD_OPEN = /<head\b[^>]*>/i;
const HEAD_CLOSE = '</head>';

/**
 * Add the directive to one page's head.
 *
 * Appended rather than prepended: `<meta charset>` has to appear in the first
 * 1024 bytes and Docusaurus writes it first, so nothing goes in front of it.
 *
 * A page that already carries a robots tag is left alone and reports
 * `added: false`. That is not merely idempotence for its own sake -- a staging
 * build may already say noindex site-wide, and a second tag would not override
 * the first. `react-helmet-async` renders both, which is exactly why `lint:seo`
 * C1 counts canonicals rather than requiring one.
 */
function addNoindex(html) {
  const open = HEAD_OPEN.exec(html);
  const close = html.toLowerCase().indexOf(HEAD_CLOSE);
  if (!open || close === -1 || close < open.index) {
    throw new Error('no <head>…</head> to rewrite');
  }

  const head = html.slice(open.index + open[0].length, close);
  // Attribute quoting and order are not ours to predict -- a minifier writes
  // them unquoted and reordered, and the sibling check in MarketDataApp/website
  // once read every built page as having no robots tag for exactly that reason.
  if (/<meta\s[^>]*name\s*=\s*"?robots"?/i.test(head)) {
    return { html, added: false };
  }

  return {
    html: html.slice(0, close) + ROBOTS + html.slice(close),
    added: true,
  };
}

module.exports = { addNoindex, ROBOTS };
