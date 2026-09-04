'use strict';

/**
 * Stamps `noindex, nofollow` onto every built page under `/internal/`.
 *
 * WHAT is wrong and WHY it is fixed this way is in `lib/internal-head.js`.
 * This file is the wiring, and it has two decisions of its own.
 *
 * ---------------------------------------------------------------------------
 * WHY THE WRITE IS ATOMIC
 * ---------------------------------------------------------------------------
 *
 * Docusaurus runs postBuild hooks concurrently with `Promise.all`, and
 * `plugins/markdown-twins.js` READS built HTML in its own postBuild. A plain
 * `writeFile` races a reader of the same path, and the bad outcome is not a
 * wrong twin -- it is a TRUNCATED read, months from now, on a build machine.
 * Writing to a temporary name and renaming over the target removes the race
 * rather than narrowing it. Same reason and same shape as the write in
 * `plugins/not-found-head.js`.
 *
 * Which of the two versions a concurrent reader gets does not matter here:
 * `internal` is excluded from llms.txt by stem, so no consumer's answer
 * depends on whether it saw the tag.
 *
 * ---------------------------------------------------------------------------
 * WHY FINDING NOTHING IS AN ERROR
 * ---------------------------------------------------------------------------
 *
 * This plugin exists to make one assertion true about one directory. If the
 * directory is not there, the assertion is not true, and a warning would let
 * the build ship pages nothing had marked. `lint:seo` M1 is the gate; a build
 * that reaches it having silently stamped zero pages should already have
 * stopped here.
 */

const { promises: fs } = require('node:fs');
const path = require('node:path');
const { addNoindex } = require('../lib/internal-head');

const SECTION = 'internal';

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

module.exports = function internalHeadPlugin() {
  return {
    name: 'internal-head',

    async postBuild({ outDir }) {
      const root = path.join(outDir, SECTION);

      let targets;
      try {
        targets = await pagesUnder(root);
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        throw new Error(
          `[internal-head] no ${SECTION}/ in the build. The docs plugin instance ` +
            'that owns it is in docusaurus.config.js; either it was removed or the ' +
            'section moved, and this plugin would silently do nothing either way.'
        );
      }

      if (!targets.length) {
        throw new Error(`[internal-head] ${SECTION}/ built no pages; nothing was marked noindex`);
      }

      let added = 0;
      for (const target of targets) {
        const html = await fs.readFile(target, 'utf8');
        const result = addNoindex(html);
        if (!result.added) continue;
        const temporary = `${target}.tmp`;
        await fs.writeFile(temporary, result.html, 'utf8');
        await fs.rename(temporary, target);
        added += 1;
      }

      // Every number on every build. "stamped 2 of 2" and "stamped 0 of 2" have
      // to read differently: the second is what a staging build produces, where
      // every page already says noindex, and it is also what a silently broken
      // matcher would produce on production.
      console.log(`[internal-head] ${SECTION}/: stamped ${added} of ${targets.length} page(s) noindex`);
    },
  };
};
