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
 * same Markdown after this lands.
 *
 * ---------------------------------------------------------------------------
 * A ROUTE WITH NO SOURCE STILL GETS A TWIN
 * ---------------------------------------------------------------------------
 *
 * It did not until 2026-08-30. Ten of 271 routes have no `.md`, `.mdx`,
 * `/index.md` or `/index.mdx` anywhere in the tree -- the docs root, the 404,
 * the Algolia search UI and seven generated tag pages -- and they were counted
 * and skipped. `cleanMdx` was not the wrong converter for them; they have no
 * input for any converter, so the rendered page is the only statement of what
 * they say. `lib/html-to-md.js` derives the twin from that. It is a SECOND
 * path, not a replacement: a route with a source is still resolved through the
 * candidate list above and converted by `cleanMdx`, to the same bytes as
 * before.
 *
 * The skip was invisible from outside, which is what made it worth closing.
 * The worker answers `Accept: text/markdown` and FALLS THROUGH to the HTML
 * proxy for a twin-less route, so `/docs/` returned a page. Its replacement --
 * a Cloudflare Transform Rule rewriting `<path>` to `<path>index.md`
 * (MarketData-App/www-marketdata-app#15) -- is unconditional and cannot fall
 * through, so each of those ten would have become a 404 on the day the worker
 * was switched off, with no deploy and no other cause. `postBuild` now fails
 * the build on an untwinned route rather than counting it, so the next one
 * cannot reach a deploy at all.
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
const { cleanHtml } = require('../lib/html-to-md');
const { routeSuffix, stemOf } = require('../lib/route-stem');
const { categoryOf, titleForStem, descriptionFromHtml } = require('../lib/llms-txt');
const { emitLlmsTxt } = require('./llms-txt');

/** The worker's candidate order. Do not reorder without changing the worker. */
const CANDIDATES = ['.md', '.mdx', '/index.md', '/index.mdx'];

/** Absolute URL a twin's canonical points at. Matches the worker's Link header. */
const CANONICAL_ORIGIN = 'https://www.marketdata.app/docs';

// routeSuffix and stemOf live in lib/route-stem.js because plugins/llms-txt.js
// needs the identical mapping: this plugin WRITES a twin at a path derived from
// the stem and that one READS it back. Two copies that drifted would not fail
// loudly -- the llms.txt index would quietly lose the routes they disagreed on.
//
// stemOf still returns null for the docs root, which has no source of its own.
// That is why the candidate list is not consulted for it -- but it is not a
// reason to emit nothing. See `twinTargets`.

/**
 * The built HTML file a route is served from, which is what the twin is
 * derived from when no source resolves.
 *
 * "/docs/"          -> index.html
 * "/docs/api/tags/" -> api/tags/index.html
 * "/docs/404.html"  -> 404.html        (a file, not a directory route)
 */
function builtHtmlOf(outDir, routePath, baseUrl) {
  const rel = routeSuffix(routePath, baseUrl);
  return path.join(outDir, rel.endsWith('.html') ? rel : path.join(rel, 'index.html'));
}

/**
 * Every name one route's Markdown is written under, relative to outDir.
 *
 * The three names and their reasons are in the header. Two routes get a set
 * that is not simply `<stem>` three ways, and both are on the no-source path:
 *
 *   THE DOCS ROOT gets two, not three. Its stem is empty, so the alias name
 *   would be `.md` -- a name nothing would guess and Pages would not serve as a
 *   page. `index.md` already answers for it, and that is the name the Transform
 *   Rule rewrites `/docs/` to, so it is the one that has to exist.
 *
 *   THE 404 gets `404.md`, `404/index.md` and `404.html.md` rather than
 *   `404.html.md`, `404.html/index.md` and `404.html/index.html.md`. It is a
 *   FILE and not a directory route, so the rule "append .md to the served
 *   document's path" gives `404.html.md`, while the guessed name is `404.md`
 *   and the llmstxt-convention name is `404/index.md`. These are the three
 *   NOT_FOUND_TWINS in MarketDataApp/website's src/lib/markdown-twins.mjs, and
 *   they agree with that half of the origin deliberately. `404/` holds that one
 *   file and no index.html, so it adds no route and no sitemap entry.
 *
 * Every OTHER stem returns exactly what this function returned before it
 * existed, in the same order, so the source path's output is unchanged.
 */
function twinTargets(stem) {
  if (stem === null) return ['index.md', 'index.html.md'];
  if (stem === '404.html') return ['404.md', '404/index.md', '404.html.md'];
  return [`${stem}.md`, `${stem}/index.md`, `${stem}/index.html.md`];
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
      const origin = new URL(CANONICAL_ORIGIN).origin;
      let fromSource = 0;
      let fromHtml = 0;
      let files = 0;
      const untwinned = [];
      const indexed = [];

      for (const routePath of routesPaths) {
        const stem = stemOf(routePath, baseUrl);

        // ---- Path 1: the route has a Markdown source. Unchanged. ----------
        // Same candidates, same order, same first match, same converter, same
        // bytes. `stem === null` only at the docs root, which has no source to
        // look for, so the lookup is skipped rather than attempted with null.
        let markdown = null;
        let html = null;
        if (stem !== null) {
          const found = await readFirstCandidate(siteDir, stem);
          if (found) {
            markdown = cleanMdx(found.text, { baseUrl: CANONICAL_ORIGIN });
            fromSource++;
          }
        }

        // ---- Path 2: no source. Derive the twin from the built page. ------
        // Reached only when path 1 found nothing, so it can neither change nor
        // shadow a twin that path 1 produces. postBuild runs after the HTML is
        // on disk, which the `ENOENT` below would say plainly if it stopped
        // being true.
        if (markdown === null) {
          const htmlFile = builtHtmlOf(outDir, routePath, baseUrl);
          try {
            html = await fs.readFile(htmlFile, 'utf8');
          } catch (err) {
            if (err.code !== 'ENOENT') throw err;
            untwinned.push(`${routePath} (no source, and no ${path.relative(outDir, htmlFile)})`);
            continue;
          }
          markdown = cleanHtml(html, { origin, siteTitle: siteConfig.title });
          if (markdown === null) {
            untwinned.push(`${routePath} (no source, and no .main-wrapper or <main> in its HTML)`);
            continue;
          }
          fromHtml++;
        }

        for (const name of twinTargets(stem)) {
          const target = path.join(outDir, name);
          await fs.mkdir(path.dirname(target), { recursive: true });
          await fs.writeFile(target, markdown, 'utf8');
          files++;
        }

        // ---- The llms.txt corpus ------------------------------------------
        // Collected HERE rather than in a plugin of its own because Docusaurus
        // runs postBuild hooks with `Promise.all` -- concurrently, not in the
        // order docusaurus.config.js lists them. A second plugin reading these
        // twins back off disk would race the loop that writes them, and would
        // usually lose. One traversal, in order, by construction.
        const indexStem = stem === null ? '' : stem;
        if (categoryOf(indexStem)) {
          if (html === null) {
            try {
              html = await fs.readFile(builtHtmlOf(outDir, routePath, baseUrl), 'utf8');
            } catch (err) {
              if (err.code !== 'ENOENT') throw err;
              html = '';
            }
          }
          indexed.push({
            stem: indexStem,
            markdown,
            title: titleForStem(indexStem, markdown),
            description: descriptionFromHtml(html),
          });
        }
      }

      // Every number, every build. One total would read the same whether the
      // routes without a source were converted from their HTML or quietly
      // dropped, and that is the exact failure this pass was changed to end.
      console.log(
        `[markdown-twins] ${fromSource + fromHtml} of ${routesPaths.length} route(s) ` +
          `twinned as ${files} file(s): ${fromSource} from a Markdown source via ` +
          `cleanMdx, ${fromHtml} from the built page via cleanHtml`
      );

      // A route with no twin is a 404 waiting for the worker to be retired --
      // see the header. It cannot be a warning, because a warning is what the
      // count was, and the count is what let ten of them ship.
      if (untwinned.length) {
        throw new Error(
          `[markdown-twins] ${untwinned.length} route(s) would ship with no ` +
            `Markdown twin:\n  ${untwinned.join('\n  ')}\n` +
            'Every built route must have one. The Cloudflare Transform Rule that ' +
            'replaces the worker rewrites <route> to <route>index.md ' +
            'unconditionally, so a route without a twin returns 404 rather than ' +
            'falling through to HTML.'
        );
      }

      await emitLlmsTxt({ entries: indexed, outDir, routeCount: routesPaths.length });

      if (fromSource === 0) {
        throw new Error(
          '[markdown-twins] no twin resolved a Markdown source — every route fell ' +
            'back to its rendered HTML. The candidate list or the source tree is ' +
            'wrong, and shipping this build would replace every hand-written page ' +
            'with a conversion of its own chrome.'
        );
      }
    },
  };
};
