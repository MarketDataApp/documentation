'use strict';

/**
 * Writes the documentation redirects into the build as Cloudflare `_redirects`
 * rules, so Pages serves a real 301 instead of a page that fakes one.
 *
 * ---------------------------------------------------------------------------
 * What this replaces
 * ---------------------------------------------------------------------------
 *
 * `@docusaurus/plugin-client-redirects` emits a tiny HTML file per redirect
 * carrying `<meta http-equiv="refresh">`. That is a page, not a redirect: it
 * answers 200, and only a browser that executes the markup ends up anywhere
 * else. The edge worker papered over it by reading every `/docs/` HTML
 * response body under 4 KB, matching the refresh tag, and returning a 301.
 *
 * Two defects came from doing it that way:
 *
 *   1. It could not work for HEAD. A HEAD response has no body, so the match
 *      never fired and the same URL answered 301 to GET and 200 to HEAD. Link
 *      checkers, uptime monitors and `curl -I` recorded all 19 of these as live
 *      final pages -- the opposite of the intent, and invisible because the
 *      status is a success. See MarketDataApp/www-marketdata-app#2.
 *   2. It cost every reader. The worker buffered the body of EVERY OK
 *      `text/html` response under `/docs/` -- roughly 28 KB a page -- to run a
 *      regex that matches on 19 URLs.
 *
 * Cloudflare applies `_redirects` before serving an asset: "Redirects are
 * always followed, regardless of whether or not an asset matches the incoming
 * request." So a rule here shadows the stub file, answers every method
 * identically, and needs no code at the edge at all.
 *
 * ---------------------------------------------------------------------------
 * Why the trailing slash, and why only one rule per redirect
 * ---------------------------------------------------------------------------
 *
 * `trailingSlash: true`, so `/docs/x` is not a real URL here -- Pages
 * normalises it with a 308 to `/docs/x/` and the rule matches on the second
 * hop. That is already the observed behaviour: before this plugin existed,
 * `/docs/api/troubleshooting/http-status-codes` answered 308 and then the
 * worker's 301. One rule in the slashed form therefore covers both spellings,
 * and a second rule for the bare form would be dead weight.
 *
 * ---------------------------------------------------------------------------
 * Where the file lands
 * ---------------------------------------------------------------------------
 *
 * Written to the root of `outDir`. CI then moves `build/*` into `build/docs/`,
 * so this ends up at `build/docs/_redirects` -- which is NOT where Cloudflare
 * reads it. That is fine and deliberate: the orchestrator collects them with
 * `find sources -name '_redirects'` and concatenates every source's file into
 * one at the deploy root. The rules below therefore carry the `/docs` prefix
 * themselves, because by the time Cloudflare reads them nothing else will add
 * it.
 */

const { promises: fs } = require('node:fs');
const path = require('node:path');
const { REDIRECTS } = require('../redirects');

/** The URL prefix this site is served under. Matches `baseUrl` in the config. */
const PREFIX = '/docs';

module.exports = function redirectsFilePlugin() {
  return {
    name: 'redirects-file',

    async postBuild({ outDir }) {
      // --- no rule shadows a page this build serves -----------------------
      //
      // The same Cloudflare behaviour this whole file relies on -- "Redirects
      // are always followed, regardless of whether or not an asset matches the
      // incoming request" -- is a loaded gun pointed the other way. A rule
      // whose source is also a real page makes that page unreachable, and
      // NOTHING else notices: the page is still in the build, still in the
      // sitemap, still passes the link checker, because the file is right
      // there. The only thing wrong is a line in this array.
      //
      // This is not hypothetical. On 2026-08-25 the staging branch carried
      // `/sdk/go/stocks/bulkquotes -> /sdk/go/stocks/quotes`, correct there
      // because the Go v2 rewrite removed that page. On main the page still
      // exists and answers 200. Cherry-picking the list across branches would
      // have 301'd a live page away with every check green. It was caught by
      // comparing two arrays by hand, which is not a process.
      //
      // Branches legitimately carry different redirect lists here, so this
      // will keep being a live risk. Borrowed from the website repo, which has
      // gated the same defect in scripts/lint-links.mjs since 2026-08-24.
      const shadowed = [];
      for (const { from, to } of REDIRECTS) {
        const page = path.join(outDir, from, 'index.html');
        try {
          await fs.access(page);
          shadowed.push({ from, to, page: path.relative(outDir, page) });
        } catch (err) {
          if (err.code !== 'ENOENT') throw err;
        }
      }

      if (shadowed.length) {
        const detail = shadowed
          .map((r) => `    ${PREFIX}${r.from}/ -> ${PREFIX}${r.to}/   shadows ${r.page}`)
          .join('\n');
        throw new Error(
          `[redirects-file] ${shadowed.length} redirect(s) would shadow a page ` +
            `this build serves:\n${detail}\n\n` +
            '  Cloudflare follows a matching redirect whether or not the asset ' +
            'exists,\n  so each of these makes a real page unreachable. Delete the ' +
            'rule from\n  redirects.js, or delete the page.'
        );
      }

      const lines = [
        '# Documentation redirects. Generated by plugins/redirects-file.js from',
        '# redirects.js — edit that array, never this file.',
        '#',
        '# Cloudflare applies these before serving an asset, so they shadow the',
        '# stub pages Docusaurus emits for the same paths and answer every',
        '# method the same way. Nothing at the edge is involved.',
        '',
        ...REDIRECTS.map(({ from, to }) => `${PREFIX}${from}/  ${PREFIX}${to}/  301`),
        '',
      ];

      await fs.writeFile(path.join(outDir, '_redirects'), lines.join('\n'), 'utf8');

      console.log(
        `[redirects-file] ${REDIRECTS.length} redirect(s) written to _redirects; ` +
          'none shadow a built page'
      );

      if (REDIRECTS.length === 0) {
        throw new Error(
          '[redirects-file] no redirects written. Shipping this build would turn ' +
            'working redirects into 404s now that the client-redirects plugin is gone.'
        );
      }
    }
  };
};
