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
const INTERNAL = 'internal';

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

      const internalRoot = path.join(outDir, INTERNAL);
      const internalPages = pages.filter((p) => p === internalRoot || p.startsWith(`${internalRoot}${path.sep}`));

      // This plugin exists to make one assertion true about one directory. If
      // the directory is not there the assertion is not true, and a warning
      // would let the build ship pages nothing had marked.
      if (!internalPages.length) {
        throw new Error(
          `[noindex-head] no ${INTERNAL}/ pages in the build. The docs plugin instance that ` +
            'owns them is in docusaurus.config.js; either it was removed or the section moved, ' +
            'and this plugin would silently do nothing either way.'
        );
      }

      let stamped = 0;
      let stripped = 0;
      for (const target of pages) {
        const html = await fs.readFile(target, 'utf8');
        const result = applyHeadRules(html, { internal: internalPages.includes(target) });
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
      console.log(
        `[noindex-head] ${pages.length} page(s) read; stamped ${stamped} of ${internalPages.length} ` +
          `internal page(s) noindex; stripped ${stripped} canonical(s) from noindex pages`
      );
    },
  };
};
