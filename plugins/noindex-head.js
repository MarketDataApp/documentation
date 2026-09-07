'use strict';

/**
 * Applies both `/noindex/` head rules to the build. WHAT they are and WHY is in
 * `lib/noindex-head.js`; this file is the wiring, and it has three decisions.
 *
 * ---------------------------------------------------------------------------
 * WHY IT WALKS THE WHOLE BUILD
 * ---------------------------------------------------------------------------
 *
 * Rule 2 -- a page that says `noindex` emits no canonical -- is not about one
 * directory. On staging it is about every page in the build, because
 * `noIndex: process.env.PROD !== "true"` marks the whole site. Narrowing the
 * walk to `/internal/` would leave the larger half of the defect in place and
 * a passing log line beside it.
 *
 * ---------------------------------------------------------------------------
 * WHY 404.html IS SKIPPED
 * ---------------------------------------------------------------------------
 *
 * `plugins/not-found-head.js` owns that file and strips more from it -- og:url
 * and the hreflang alternates as well as the canonical. Docusaurus runs
 * postBuild hooks concurrently, so two hooks writing one file is a lost-update
 * race whichever order they happen to take. Leaving it out is the fix; L1 and
 * L2 gate that page separately.
 *
 * ---------------------------------------------------------------------------
 * WHY THE WRITE IS ATOMIC
 * ---------------------------------------------------------------------------
 *
 * `plugins/markdown-twins.js` READS built HTML in its own postBuild, to derive
 * a twin for the ten routes that have no Markdown source. A plain `writeFile`
 * races a reader of the same path, and the bad outcome is not a wrong twin --
 * it is a TRUNCATED read, on a build machine, months from now. Writing to a
 * temporary name and renaming over the target removes the race rather than
 * narrowing it: `rename` within a directory is atomic, so a concurrent reader
 * opens either the whole old file or the whole new one.
 *
 * Which one it gets does not matter. `cleanHtml` reads `<main>` and `<title>`,
 * and neither rule here touches either.
 */

const { promises: fs } = require('node:fs');
const path = require('node:path');
const { applyHeadRules } = require('../lib/noindex-head');

/** The section whose pages get the directive added. */
/**
 * The route roots whose pages must say `noindex, nofollow`.
 *
 * `internal` is our own reference material -- see docusaurus.config.js.
 *
 * `search` is the Algolia search UI. It holds no content of its own: it is a
 * form, and every result it shows already has its own indexable page. Its
 * result "pages" are the SAME route with a query string
 * (`/docs/search/?q=candles`), so one directive on the route covers the UI and
 * every result view with it -- there is no second page to mark.
 *
 * It is excluded from the sitemap for the same reason, in
 * `docusaurus.config.js`. The two have to agree: `lint:seo` D2 fails a build
 * that advertises a noindex route in the sitemap, so marking this without
 * excluding it turns the contradiction into a red build rather than a shipped
 * one. The marketing half of the origin already excludes its own `/search/`
 * and `/review/*`, so this settles a convention across both halves rather than
 * inventing one here.
 */
const NOINDEX_ROOTS = ['internal', 'search'];

/**
 * THE SEARCH PAGE ENDS UP WITH TWO ROBOTS TAGS, AND THAT IS THE FIX WORKING.
 *
 * Docusaurus's own SearchPage emits, in theme-search-algolia:
 *
 *   <meta property="robots" content="noindex, follow" />
 *
 * `property` is the Open Graph attribute. A robots directive is read from
 * `name`, so **that tag has never instructed any crawler** -- Docusaurus has
 * been trying to noindex its own search page with a spelling nothing acts on.
 * The page was therefore indexable AND in our sitemap.
 *
 * `hasRobots()` in lib/noindex-head.js keys on `name` for exactly that reason,
 * so it does not count the theme's tag and this plugin adds a real one. The
 * built page then carries both: the theme's inert `property=robots` and our
 * effective `name=robots`. They do not conflict, because only one of them is a
 * directive at all.
 *
 * Do not "tidy" this by teaching hasRobots to accept `property` -- that would
 * make the plugin skip the page and restore the original defect, silently.
 */

/** Owned by plugins/not-found-head.js. See the header. */
const SKIP = new Set(['404.html']);

/** Every index.html under a directory, depth first. */
async function pagesUnder(dir) {
  const found = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await pagesUnder(full)));
    else if (entry.name === 'index.html') found.push(full);
  }
  return found;
}

module.exports = function noindexHeadPlugin() {
  return {
    name: 'noindex-head',

    async postBuild({ outDir }) {
      const pages = (await pagesUnder(outDir)).filter((p) => !SKIP.has(path.relative(outDir, p)));

      // Each root is resolved and counted SEPARATELY, and each must match at
      // least one page. A combined count would let one root go empty while the
      // other kept the total non-zero -- which is exactly the shape this
      // plugin's own error message warns about, one level up.
      const byRoot = new Map();
      for (const root of NOINDEX_ROOTS) {
        const dir = path.join(outDir, root);
        const matched = pages.filter((p) => p === dir || p.startsWith(`${dir}${path.sep}`));
        if (!matched.length) {
          throw new Error(
            `[noindex-head] no ${root}/ pages in the build. Whatever owns that route is in ` +
              'docusaurus.config.js; either it was removed or the section moved, and this ' +
              'plugin would silently do nothing for that root either way.'
          );
        }
        byRoot.set(root, matched);
      }
      const noindexPages = new Set([...byRoot.values()].flat());

      let stamped = 0;
      let stripped = 0;
      for (const target of pages) {
        const html = await fs.readFile(target, 'utf8');
        const result = applyHeadRules(html, { noindex: noindexPages.has(target) });
        if (!result.changed) continue;
        if (result.addedNoindex) stamped += 1;
        stripped += result.strippedCanonical;
        const temporary = `${target}.tmp`;
        await fs.writeFile(temporary, result.html, 'utf8');
        await fs.rename(temporary, target);
      }

      // Every number, every build. "stamped 0" is what a staging build
      // correctly produces -- every page already says noindex there -- and it
      // is also what a silently broken matcher would produce on production.
      // The two have to be told apart by the canonical figure beside them.
      // Every number, every build, and PER ROOT. One total would hide a root
      // that matched nothing the moment another root still matched something.
      const perRoot = [...byRoot].map(([root, ps]) => `${root} ${ps.length}`).join(', ');
      console.log(
        `[noindex-head] ${pages.length} page(s) read; stamped ${stamped} of ${noindexPages.size} ` +
          `noindex page(s) (${perRoot}); stripped ${stripped} canonical(s) from noindex pages`
      );
    },
  };
};
