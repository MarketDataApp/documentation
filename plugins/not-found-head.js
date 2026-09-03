'use strict';

/**
 * Rewrites the head of the built 404 page: no URL of its own, and `noindex`.
 *
 * WHAT is wrong and WHY it is worth fixing is in `lib/not-found-head.js`, with
 * the production measurements. This file is only the wiring, and it has two
 * decisions of its own.
 *
 * ---------------------------------------------------------------------------
 * WHY postBuild AND NOT A SWIZZLE
 * ---------------------------------------------------------------------------
 *
 * The tags come from `@theme/SiteMetadata`, which takes no props from the
 * route and offers no hook. Suppressing them at the source means swizzling it
 * — copying a core theme internal that ALSO emits `og:title`, the hreflang
 * alternates and the Algolia search metadata into `src/theme/`, and then
 * carrying that copy across every Docusaurus upgrade, for one tag on one page.
 * That trade was considered and rejected once already; the record is in
 * docs/SEO-GAPS.md.
 *
 * Emitting a competing tag from a later `<Head>` does not work either.
 * react-helmet-async renders two `<link rel="canonical">` with different
 * `href` rather than letting the second win — which is exactly why `lint:seo`
 * rule C1 counts canonicals instead of merely requiring one. A second tag
 * would make the page worse, not better.
 *
 * So the change is made where the artefact is: after the HTML is written, on
 * one file, in a few lines that touch nothing in `node_modules`.
 *
 * ---------------------------------------------------------------------------
 * WHY THE WRITE IS ATOMIC
 * ---------------------------------------------------------------------------
 *
 * Docusaurus runs postBuild hooks with `Promise.all` — concurrently, not in
 * the order docusaurus.config.js lists them (see `commands/build.js`). And
 * `plugins/markdown-twins.js` READS this same `404.html` in its own postBuild,
 * to derive the 404's Markdown twin from the rendered page.
 *
 * A plain `writeFile` therefore races a reader of the same path, and the bad
 * outcome is not a wrong twin — it is a TRUNCATED read, converting to a twin
 * with no body, or failing the build with "no .main-wrapper" on a build that
 * is fine. Intermittently, on a build machine, months from now.
 *
 * Writing to a temporary name and renaming over the target removes the race
 * rather than narrowing it: `rename` within a directory is atomic, so a
 * concurrent reader opens either the old file or the new one, never half of
 * one. Both convert identically — `cleanHtml` reads `<main>` and the `<title>`,
 * and this touches neither — so which one it gets does not matter, only that
 * it is whole. Same reason and same shape as the write in `plugins/llms-txt.js`.
 */

const { promises: fs } = require('node:fs');
const path = require('node:path');
const { fixNotFoundHead } = require('../lib/not-found-head');

/** Docusaurus writes the 404 to the root of outDir, as a file and not a route. */
const NOT_FOUND = '404.html';

module.exports = function notFoundHeadPlugin() {
  return {
    name: 'not-found-head',

    async postBuild({ outDir }) {
      const target = path.join(outDir, NOT_FOUND);

      let html;
      try {
        html = await fs.readFile(target, 'utf8');
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        // Not a warning. This plugin exists to make one assertion true about
        // one file; if the file is not there, the assertion is not true and
        // the build should say so rather than ship a page nothing checked.
        throw new Error(
          `[not-found-head] no ${NOT_FOUND} in the build. Docusaurus writes one ` +
            'for every site, so either the build is incomplete or the 404 has ' +
            'moved — and this plugin would silently do nothing either way.'
        );
      }

      const { html: fixed, removed, addedRobots } = fixNotFoundHead(html);

      if (removed.length || addedRobots) {
        const temporary = `${target}.tmp`;
        await fs.writeFile(temporary, fixed, 'utf8');
        await fs.rename(temporary, target);
      }

      // Every number, every build, in the same spirit as [markdown-twins]:
      // "removed 4" and "removed 0" have to read differently, because a
      // Docusaurus upgrade that renames the tags would produce the second one
      // and nothing else would say so. `lint:seo` L1 and L2 are the gate; this
      // line is what tells you which of the two ways it went green.
      console.log(
        `[not-found-head] ${NOT_FOUND}: removed ${removed.length} self-naming ` +
          `tag(s)${removed.length ? ` (${removed.join(', ')})` : ''}; ` +
          `${addedRobots ? 'added' : 'kept the existing'} robots directive`
      );
    },
  };
};
