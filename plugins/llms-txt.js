'use strict';

/**
 * Writes the two llms.txt artifacts for the documentation deploy.
 *
 *   <outDir>/llms.txt        an index of every content route, categorised
 *   <outDir>/llms-full.txt   every route's Markdown, concatenated
 *
 * NOT A PLUGIN, and that is deliberate. Docusaurus runs `postBuild` hooks with
 * `await Promise.all(plugins.map(...))` -- concurrently, in no defined order,
 * whatever order docusaurus.config.js lists them in. A separate plugin reading
 * the twins back off disk would race markdown-twins writing them and would
 * usually lose: the first attempt at this found 259 of 261 twins missing.
 *
 * So markdown-twins calls this at the end of its own pass, with the corpus it
 * already has in memory. One traversal, ordered by construction rather than by
 * a convention a future reader could reasonably reorder.
 *
 * After CI's "Restructure build output" step these land at `build/docs/` and
 * sync to R2 as `{env}/sources/docs/docs/llms.txt`. The doubled segment is
 * correct -- only `404.html` and `_headers` are lifted to the build root -- and
 * the orchestrator splices from the nested path.
 *
 * DO NOT lift a copy to `sources/docs/llms.txt`. The merge runs
 * `rsync -a sources/docs/ build/` then `rsync -a sources/website/ build/` in
 * alphabetical order, so the website's own root `llms.txt` would overwrite it
 * with no error. That is the last-write-wins hazard `_headers` and `_redirects`
 * are hand-concatenated to avoid.
 */

const { promises: fs } = require('node:fs');
const path = require('node:path');

const { renderIndex, renderFull, assertNoSpliceMarker } = require('../lib/llms-txt');

const CANONICAL_ORIGIN = 'https://www.marketdata.app/docs';

/**
 * Deliberately a constant rather than `siteConfig.title`, which is
 * "Market Data Docs (staging)" on staging. The heading names the documentation,
 * not the environment serving it, and the orchestrator splices this into a file
 * where "(staging)" would be noise.
 */
const TITLE = 'Market Data Documentation';

const SUMMARY =
  'The Market Data REST API, its SDKs for Go, Python, JavaScript, C#, PHP and ' +
  'Java, and the Google Sheets add-on.';

/**
 * NO URL convention here, deliberately.
 *
 * Every page is served under three names -- `<stem>.md`, `<stem>/index.md` and
 * `<stem>/index.html.md`. This paragraph named all three, then named one, and
 * now names none.
 *
 * One was still one too many. These sections are spliced into the site root's
 * llms.txt, whose "Getting started" already explains the convention for the
 * WHOLE site and in both directions -- append `index.md` to reach Markdown,
 * remove it to reach HTML. Ours restated the weaker half of that seven lines
 * later in the same document. Two statements of one rule is what the root
 * file's owner ruled against; dropping to one form fixed the wording and left
 * the duplication.
 *
 * Nothing is lost standalone: every entry below is already an absolute `.md`
 * URL, so a reader never has to construct one.
 *
 * What stays is the one thing the root file does not have -- a pointer to the
 * authentication reference. That is a link to more detail rather than a
 * restatement of the root's token guidance.
 */
const PREAMBLE = [
  'Authentication, and how to obtain a token:',
  `${CANONICAL_ORIGIN}/api/authentication/index.md`,
].join('\n');

/**
 * Write one file atomically: fully to a temporary name, then rename over the
 * target. `rename` within a directory is atomic, so a crash mid-write leaves
 * the previous file or no file, never a truncated one.
 *
 * A half-written llms-full.txt is the failure nothing downstream can see: the
 * orchestrator finds its marker, the splice runs, the file still parses, and
 * the documentation is quietly cut off partway through.
 */
async function writeAtomic(target, contents) {
  const temporary = `${target}.tmp`;
  await fs.writeFile(temporary, contents, 'utf8');
  await fs.rename(temporary, target);
}

async function emitLlmsTxt({ entries, outDir, routeCount }) {
  // renderIndex and renderFull both refuse an empty corpus. Letting that throw
  // here is the point: an empty artifact splices cleanly and loses everything.
  const index = renderIndex({
    entries,
    origin: CANONICAL_ORIGIN,
    title: TITLE,
    summary: SUMMARY,
    preamble: PREAMBLE,
  });
  const full = renderFull({ entries, origin: CANONICAL_ORIGIN });

  // Before writing, not after: an artifact carrying the marker must never
  // reach R2, where the orchestrator would find it and report the failure from
  // the wrong repository.
  assertNoSpliceMarker(index, 'llms.txt');
  assertNoSpliceMarker(full, 'llms-full.txt');

  await writeAtomic(path.join(outDir, 'llms.txt'), index);
  await writeAtomic(path.join(outDir, 'llms-full.txt'), full);

  const withoutDescription = entries.filter((entry) => !entry.description).length;
  console.log(
    `[llms-txt] ${entries.length} of ${routeCount} route(s) indexed in llms.txt ` +
      `(${Math.round(index.length / 1024)} KB); llms-full.txt is ` +
      `${Math.round(full.length / 1024)} KB. ` +
      `${routeCount - entries.length} navigation artifact(s) skipped, ` +
      `${withoutDescription} without a description.`
  );
}

module.exports = { emitLlmsTxt, CANONICAL_ORIGIN, TITLE, PREAMBLE };
