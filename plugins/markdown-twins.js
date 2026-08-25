'use strict';

/**
 * Emits a cleaned Markdown twin of every documentation route into the build.
 *
 * ---------------------------------------------------------------------------
 * What this replaces
 * ---------------------------------------------------------------------------
 *
 * The edge worker used to serve Markdown by fetching the SOURCE from
 * raw.githubusercontent.com on every request, off a branch, and running
 * cleanMdx on it at the edge. That had three costs:
 *
 *   1. A request-time dependency on GitHub's availability and rate limits, in
 *      front of our own docs.
 *   2. Markdown served from a BRANCH rather than from the deployed commit, so
 *      /docs/x.md could disagree with /docs/x/ between a merge and a deploy.
 *   3. cleanMdx living at the edge, which forced a vendored copy of
 *      lib/mdx-to-md.js into MarketDataApp/www-marketdata-app.
 *
 * Doing the same conversion here, once per build, removes all three. The worker
 * is left proxying a static file and adding one header.
 *
 * ---------------------------------------------------------------------------
 * Why it resolves sources the way it does
 * ---------------------------------------------------------------------------
 *
 * The candidate list below is the worker's, copied deliberately rather than
 * re-derived from Docusaurus's route metadata:
 *
 *     <stem>.md   <stem>.mdx   <stem>/index.md   <stem>/index.mdx
 *
 * Re-deriving it would have been tidier and would have risked emitting a
 * different file than the one the worker has been serving. Same input, same
 * order, same first match, so any URL that returns Markdown today returns the
 * same Markdown after this lands. A route with no source -- an auto-generated
 * category page, for instance -- gets no twin, which is what the worker's
 * fall-through does today.
 *
 * ---------------------------------------------------------------------------
 * The three names per route, and why
 * ---------------------------------------------------------------------------
 *
 *     api/stocks/candles.md            what a person or an agent guesses
 *     api/stocks/candles/index.md      what sits beside index.html
 *     api/stocks/candles/index.html.md the llmstxt.org v2 spelling
 *
 * All three are URLs the worker answers today, so all three are written. They
 * are one string written three times, in one pass, so they cannot drift.
 *
 * `baseUrl` is "/docs/" while Docusaurus writes to the root of outDir, and CI
 * moves build/* into build/docs/ afterwards. So a file written here at
 * `api/stocks/candles.md` is served at `/docs/api/stocks/candles.md`. Do not
 * add the prefix here; it is added by the move.
 */

const { promises: fs } = require('node:fs');
const path = require('node:path');
const { cleanMdx } = require('../lib/mdx-to-md');

/** The worker's candidate order. Do not reorder without changing the worker. */
const CANDIDATES = ['.md', '.mdx', '/index.md', '/index.mdx'];

/** Absolute URL a twin's canonical points at. Matches the worker's Link header. */
const CANONICAL_ORIGIN = 'https://www.marketdata.app/docs';

/**
 * Turns a built route path into the stem the candidate list is resolved
 * against: "/docs/api/stocks/candles/" -> "api/stocks/candles".
 *
 * Returns null for the docs root, which has no source of its own.
 */
function stemOf(routePath, baseUrl) {
  const stem = routePath
    .replace(new RegExp(`^${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '')
    .replace(/^\/+|\/+$/g, '');
  return stem || null;
}

async function readFirstCandidate(siteDir, stem) {
  for (const suffix of CANDIDATES) {
    const file = path.join(siteDir, `${stem}${suffix}`);
    try {
      return { text: await fs.readFile(file, 'utf8'), file };
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  return null;
}

module.exports = function markdownTwinsPlugin() {
  return {
    name: 'markdown-twins',

    async postBuild({ siteConfig, routesPaths, outDir, siteDir }) {
      const baseUrl = siteConfig.baseUrl || '/';
      let written = 0;
      let noSource = 0;

      for (const routePath of routesPaths) {
        const stem = stemOf(routePath, baseUrl);
        if (!stem) continue;

        const found = await readFirstCandidate(siteDir, stem);
        if (!found) {
          // Auto-generated route with no Markdown source. The worker returns
          // the HTML page for these today; nothing changes.
          noSource++;
          continue;
        }

        const markdown = cleanMdx(found.text, { baseUrl: CANONICAL_ORIGIN });

        const targets = [
          path.join(outDir, `${stem}.md`),
          path.join(outDir, stem, 'index.md'),
          path.join(outDir, stem, 'index.html.md'),
        ];
        for (const target of targets) {
          await fs.mkdir(path.dirname(target), { recursive: true });
          await fs.writeFile(target, markdown, 'utf8');
        }
        written++;
      }

      // Both numbers, every build. "n twins" alone would read the same whether
      // the other routes have no source or the resolver quietly stopped
      // finding them.
      console.log(
        `[markdown-twins] ${written} route(s) written as .md, /index.md and ` +
          `/index.html.md; ${noSource} route(s) had no Markdown source`
      );

      if (written === 0) {
        throw new Error(
          '[markdown-twins] no twins written — every route failed to resolve a ' +
            'source. The worker serves these files, so shipping this build would ' +
            'take Markdown serving down.'
        );
      }
    },
  };
};
