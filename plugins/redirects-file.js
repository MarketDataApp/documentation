'use strict';

/**
 * Writes the documentation redirects into the build as Cloudflare `_redirects`
 * rules, so Pages serves a real 301 instead of a page that fakes one.
 *
 * TWO RULES PER REDIRECT, bare and slashed. This is the correction to a
 * regression, and the reasoning is not obvious, so it is written out below
 * under "Why both slash forms".
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
 * Why both slash forms
 * ---------------------------------------------------------------------------
 *
 * This plugin originally emitted only the slashed form, reasoning that
 * `trailingSlash: true` means Pages normalises `/docs/x` to `/docs/x/` with a
 * 308 and the rule matches on the second hop. That was observed behaviour at
 * the time, and it was true for the wrong reason.
 *
 * Cloudflare only normalises a trailing slash when a DIRECTORY exists at that
 * path. Measured 2026-08-25:
 *
 *   /definitely-not-a-page   404              no directory -> no normalisation
 *   /pricing                 308 -> /pricing/ directory exists -> normalised
 *
 * While @docusaurus/plugin-client-redirects was installed, every redirect
 * source had a stub page and therefore a directory, so the bare form
 * normalised. Removing the plugin removed the directories -- and a redirect
 * source has no directory by definition, since the point of it is that the page
 * is gone. All 18 bare forms went from 308-then-301 to a flat 404 on both
 * hosts, silently, because the slashed form kept working and that is what
 * everything tested.
 *
 * So both spellings need their own rule. MarketDataApp/website's hand-written
 * _redirects has paired them all along for exactly this reason; the pairing
 * looked redundant until it was measured.
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
const { REDIRECTS, SDK_PHP } = require('../redirects');

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
        // Bare first, then slashed. Order is irrelevant to Cloudflare here --
        // the two sources are distinct literals and cannot both match one
        // request -- but keeping the pair adjacent makes a missing half
        // visible when reading the generated file.
        ...REDIRECTS.flatMap(({ from, to }) => [
          `${PREFIX}${from}   ${PREFIX}${to}/  301`,
          `${PREFIX}${from}/  ${PREFIX}${to}/  301`,
        ]),
        '',
        // --- the legacy PHP SDK space, which leaves this site entirely ------
        //
        // See the SDK_PHP block in redirects.js for why these exist and why the
        // doubled prefixes are a closed set rather than a regex.
        //
        // THE COLLAPSE RULES MUST COME FIRST. Cloudflare takes the first rule
        // that matches, so `/docs/sdk-php/*` would swallow every doubled path
        // and forward the doubling intact if it were emitted above them.
        '# Legacy PHP SDK docs, now served from GitHub Pages. Generated from the',
        '# SDK_PHP block in redirects.js. Collapse rules first — Cloudflare takes',
        '# the first match, so the catch-all below must stay last.',
        ...SDK_PHP.doubledPrefixes.map(
          (dir) =>
            `${PREFIX}${SDK_PHP.source}/${dir}/${dir}/*  ${SDK_PHP.target}/${dir}/:splat  301`
        ),
        `${PREFIX}${SDK_PHP.source}/*  ${SDK_PHP.target}/:splat  301`,
        // The bare form needs its own literal. Cloudflare only normalises a
        // missing trailing slash when a directory exists at that path, and no
        // directory is built here — the same defect that took out all 18 bare
        // redirect sources in #186.
        `${PREFIX}${SDK_PHP.source}  ${SDK_PHP.target}/  301`,
        '',
      ];

      await fs.writeFile(path.join(outDir, '_redirects'), lines.join('\n'), 'utf8');

      const sdkPhpRules = SDK_PHP.doubledPrefixes.length + 2;
      console.log(
        `[redirects-file] ${REDIRECTS.length} redirect(s) written to _redirects ` +
          `as ${REDIRECTS.length * 2} rules (bare and slashed); none shadow a built page. ` +
          `Plus ${sdkPhpRules} legacy PHP SDK rules ` +
          `(${SDK_PHP.doubledPrefixes.length} collapse, 1 catch-all, 1 bare).`
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
