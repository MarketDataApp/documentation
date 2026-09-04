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

async function emitLlmsTxt({ entries, outDir, routeCount, unclassified = [], noindexCount = 0 }) {
  // A route that is neither content nor a known navigation artifact means a
  // section nobody taught lib/llms-txt.js about. It would vanish from the index
  // silently, and the old log line would have called it a navigation artifact.
  if (unclassified.length) {
    throw new Error(
      `[llms-txt] ${unclassified.length} route(s) belong to no section and are ` +
        `not navigation artifacts:\n` +
        `${[...new Set(unclassified.map((s) => s.split('/')[0]))]
          .map((d) => `    ${d}/`)
          .join('\n')}\n\n` +
        '  Add the directory to SECTIONS in lib/llms-txt.js so its pages are\n' +
        '  indexed, or to isNavigationArtifact if it is not content. Leaving it\n' +
        '  unclassified drops the pages from llms.txt with nothing to notice.'
    );
  }

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

  // ---------------------------------------------------------------------
  // A TRIPWIRE FOR AN EXTRACTOR THAT STOPPED MATCHING, NOT A CONTENT RULE
  // ---------------------------------------------------------------------
  //
  // `future.v4` put Docusaurus's Faster pipeline in charge of minification,
  // and it emits UNQUOTED attributes -- `name=description` where the previous
  // pipeline wrote `name="description"`. lib/llms-txt.js read that meta with
  // the quotes written into its regex, so it matched nothing on EVERY page.
  // llms.txt fell from 55 KB to 23 KB with all 259 entries reduced to bare
  // links.
  //
  // NOTHING FAILED. The file was still a valid index -- one H1 first, no H6,
  // every line reaching /docs/ -- so this repo's build-contract check passed,
  // and so did the orchestrator's splice preconditions in
  // MarketDataApp/www-marketdata-app, which demote its headings and require
  // exactly those properties. It was found by diffing the file against the
  // previous build, and by nothing else.
  //
  // Both numbers below were PRINTED at the time -- "23 KB" and "259 without a
  // description" -- and neither was a gate. That is the actual lesson: a count
  // in a log is not a check. So this one throws.
  //
  // A MAJORITY, deliberately, because the failure is all-or-nothing: the
  // pattern either matches the build's spelling or it does not. One page
  // lacking a description is ordinary content and must not fail a build;
  // half of them lacking one cannot be content. Do not tighten this into a
  // content rule, and do not raise it to make a build pass.
  if (entries.length > 0 && withoutDescription > entries.length / 2) {
    throw new Error(
      `[llms-txt] ${withoutDescription} of ${entries.length} entries have no ` +
        'description.\n\n' +
        'That is not a content problem at this scale -- it is descriptionFromHtml\n' +
        'no longer matching what the build writes. It last happened when the\n' +
        'minifier began emitting unquoted attributes. Check how <meta\n' +
        'name="description"> is actually spelled in build/, not the source.\n\n' +
        'llms.txt would still be structurally valid, so no other check here or\n' +
        'in the orchestrator would notice.'
    );
  }

  console.log(
    `[llms-txt] ${entries.length} of ${routeCount} route(s) indexed in llms.txt ` +
      `(${Math.round(index.length / 1024)} KB); llms-full.txt is ` +
      `${Math.round(full.length / 1024)} KB. ` +
      `${routeCount - entries.length - noindexCount} navigation artifact(s) ` +
      `skipped (all classified), ` +
      `${noindexCount} withheld for noindex, ` +
      `${withoutDescription} without a description.`
  );
}

module.exports = { emitLlmsTxt, CANONICAL_ORIGIN, TITLE, PREAMBLE };
