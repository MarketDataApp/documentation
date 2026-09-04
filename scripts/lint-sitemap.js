#!/usr/bin/env node
'use strict';

/**
 * Fails the build when the sitemap advertises a URL this build does not serve.
 *
 * ---------------------------------------------------------------------------
 * Why a sitemap needs its own check
 * ---------------------------------------------------------------------------
 *
 * A sitemap is the one artefact nothing else notices is wrong. It is not
 * rendered, no link points at it, no browser test opens it, and the link
 * checker walks the pages rather than the index of them. So a sitemap can
 * advertise a page that does not exist and every other gate in this repo stays
 * green -- which is exactly what happened in #188: 15 of 258 production URLs
 * answered 404, for weeks, with a full green board.
 *
 * MarketDataApp/website gates the same thing for the same reason, and its
 * scripts/lint-sitemap.mjs header records the sharper version of the lesson:
 * that build shipped with NO sitemap at all for months and nothing said so.
 * Hence the two assertions below that look redundant and are not -- a missing
 * sitemap and an empty sitemap both fail here rather than passing vacuously.
 *
 * ---------------------------------------------------------------------------
 * What this does and does not catch
 * ---------------------------------------------------------------------------
 *
 * This compares the sitemap against the BUILD OUTPUT, so it catches a
 * generator that lists routes which did not build.
 *
 * That is NOT what went wrong in #188. Measured on 2026-08-27, every one of
 * the 258 URLs in the production sitemap had a matching index.html in the
 * build that produced it; the files were lost afterwards, in the R2 upload
 * (see the "Upload to R2" step in .github/workflows/deploy-docs.yml, which
 * verifies its own result for that reason). So this check would have passed
 * throughout #188 and is not the fix for it.
 *
 * It is worth having anyway: it is cheap, it runs before anything is
 * published, and it closes the failure mode the issue proposed -- a category
 * added without an index page, listed but never authored -- which is real even
 * though it was not the cause this time.
 *
 * ---------------------------------------------------------------------------
 * Why it needs PROD=true
 * ---------------------------------------------------------------------------
 *
 * @docusaurus/plugin-sitemap returns early when siteConfig.noIndex is set, and
 * this site sets noIndex on every non-production build. So a staging build has
 * no sitemap to check, by design, and running this against one is a mistake
 * rather than a pass. It says so instead of exiting 0.
 *
 * Run with: pnpm run lint:sitemap   (which builds with PROD=true first)
 */

const { promises: fs } = require('node:fs');
const path = require('node:path');

const BUILD_DIR = path.resolve(__dirname, '..', 'build');
const SITEMAP = path.join(BUILD_DIR, 'sitemap.xml');

/** Matches `baseUrl` in docusaurus.config.js. */
const BASE_URL = '/docs/';

function fail(message) {
  console.error(`[lint-sitemap] ${message}`);
  process.exit(1);
}

/**
 * Turns a sitemap <loc> into the file the build must contain for it.
 *
 * `trailingSlash: true`, so every route is a directory with an index.html in
 * it. The docs root is the one entry that maps to build/index.html.
 *
 * Note the build is NOT nested under build/docs/ at this point -- CI moves it
 * there after the build, and this runs before that.
 */
function fileFor(loc) {
  const { pathname } = new URL(loc);
  if (!pathname.startsWith(BASE_URL)) return null;
  const route = pathname.slice(BASE_URL.length).replace(/\/$/, '');
  return path.join(BUILD_DIR, route, 'index.html');
}

async function main() {
  let xml;
  try {
    xml = await fs.readFile(SITEMAP, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    fail(
      `no sitemap at ${path.relative(process.cwd(), SITEMAP)}.\n` +
        '  @docusaurus/plugin-sitemap skips the sitemap when noIndex is set, and\n' +
        '  every non-production build sets it. Build with PROD=true, or run\n' +
        '  `pnpm run lint:sitemap`, which does.'
    );
  }

  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

  // An empty sitemap is a broken sitemap. Without this the summary below would
  // print "0 of 0 URLs resolve" and exit 0, which is the shape of a green
  // check that is measuring nothing -- the failure mode this file exists to
  // prevent, reproduced inside the checker.
  if (locs.length === 0) {
    fail(`${path.relative(process.cwd(), SITEMAP)} lists no URLs.`);
  }

  const offSite = [];
  const missing = [];

  for (const loc of locs) {
    const file = fileFor(loc);
    if (file === null) {
      offSite.push(loc);
      continue;
    }
    try {
      await fs.access(file);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      missing.push({ loc, file: path.relative(BUILD_DIR, file) });
    }
  }

  if (offSite.length) {
    const detail = offSite.map((l) => `    ${l}`).join('\n');
    fail(
      `${offSite.length} sitemap URL(s) are not under ${BASE_URL}:\n${detail}\n\n` +
        '  Every URL in this sitemap should be a page this build serves.'
    );
  }

  if (missing.length) {
    const detail = missing.map((m) => `    ${m.loc}\n      wants ${m.file}`).join('\n');
    fail(
      `${missing.length} of ${locs.length} sitemap URL(s) have no page in the build:\n` +
        `${detail}\n\n` +
        '  The sitemap tells Google to crawl these. Each one is a 404 with our\n' +
        '  name on it. Author the page, or stop the route from being generated.'
    );
  }

  console.log(`[lint-sitemap] ${locs.length} sitemap URL(s) all resolve to a page in the build`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
