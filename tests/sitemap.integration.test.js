'use strict';

/**
 * Integration test: every URL the deployed sitemap advertises must answer 200.
 *
 * ---------------------------------------------------------------------------
 * Why this exists
 * ---------------------------------------------------------------------------
 *
 * A sitemap is the one artefact nothing else notices is wrong. It is not
 * rendered, no link points at it, no browser test opens it, and the link
 * checker walks pages rather than the index of them. So #188 ran for twelve
 * days with a fully green board: 15 -- later 16 -- of the 258 URLs in the
 * production sitemap answered 404, five of them in the top twenty 404s on the
 * zone, roughly 79 requests a day landing on nothing.
 *
 * The build was never wrong. Every one of those pages had an index.html in the
 * build that produced the sitemap; the R2 upload deleted them afterwards. Two
 * checks now stand between that and production, and this is the outer one:
 *
 *   1. scripts/lint-sitemap.js -- the sitemap lists only pages the build made.
 *   2. the "Upload to R2" step  -- every built file really reached R2.
 *   3. this file                -- and the deployed site really serves them.
 *
 * Each covers a link the others cannot see. This one is the only check that
 * reads what the public reads.
 *
 * ---------------------------------------------------------------------------
 * What this measures, and what it CANNOT measure
 * ---------------------------------------------------------------------------
 *
 * This probe is cache-warm: a plain GET, served by whatever Cloudflare has at
 * the edge. That is deliberate -- it is the only check here that sees what a
 * visitor sees. But it means a green run proves DELIVERY, not that the
 * deployment contains the page.
 *
 * Those two diverge whenever a file leaves the origin while an edge copy
 * survives, and they stay diverged for the life of the cache entry. Measured
 * on 2026-08-27, mid-#188:
 *
 *     plain    ?cb=<random>
 *      200         404      /docs/sdk/csharp/                 HIT, age 179581
 *      200         404      /docs/sdk/go/stocks/bulkquotes/   HIT, age 171723
 *      200         200      /docs/api/stocks/    (control, genuinely present)
 *
 * `age: 179581` is 2.08 days -- exactly the deploy that deleted them. Both
 * pages were absent from production and being served from a stale edge copy,
 * and both would have passed this suite.
 *
 * Cloudflare puts the query string in the cache key, so a unique value per
 * request forces a miss and the edge must fetch from the origin. That is the
 * whole trick:
 *
 *     a cache-warm probe measures delivery, a cache-busted probe measures the
 *     deployment, and only the second can tell you what a fresh visitor will
 *     get tomorrow.
 *
 * Three numbers in #188 were wrong for want of that distinction: the issue's
 * original count of 15, a later count of 16, and the traffic figure -- which
 * is edge-side, so a dead URL served 200 from cache never enters the 404
 * report and the total is a floor rather than a count.
 *
 * WHEN A NUMBER FROM THIS SUITE MATTERS, cache-bust as well and compare. A
 * disagreement is not noise; it is a delayed failure, already queued, that
 * will surface when the cache expires with no new deploy and no new cause.
 *
 *     curl -s -o /dev/null -w '%{http_code}' "<url>?cb=$RANDOM$RANDOM"
 *
 * ---------------------------------------------------------------------------
 * Why staging asserts the OPPOSITE
 * ---------------------------------------------------------------------------
 *
 * @docusaurus/plugin-sitemap returns early when siteConfig.noIndex is set, and
 * every non-production build sets it. Staging therefore has no sitemap, by
 * design, and cannot run the probe below.
 *
 * Rather than skip -- a skipped test reads as a passing one in a summary --
 * staging asserts that the sitemap is absent. That is a real assertion about a
 * real requirement: a staging sitemap would be a second, wrong set of URLs for
 * a crawler to find. If someone drops noIndex, this fails and says why.
 *
 * Set TEST_ENV=staging or TEST_ENV=production for one host. Unset tests both.
 *
 * Run with: pnpm run test:sitemap
 * Requires network access to www.marketdata.app and www-staging.marketdata.app.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { probeInit } = require('../lib/probe-agent');

const ALL_ENVIRONMENTS = {
  staging: 'https://www-staging.marketdata.app',
  production: 'https://www.marketdata.app',
};

const SITEMAP_PATH = '/docs/sitemap.xml';

/** Requests in flight. Enough to keep the run short, low enough to be polite. */
const CONCURRENCY = 12;

/**
 * A floor, not an exact count, so authoring a page does not fail the suite.
 * It is here because "every URL in the sitemap answers 200" is trivially true
 * of a sitemap with no URLs -- the shape of a green check measuring nothing,
 * which is the failure this file exists to prevent.
 */
const MINIMUM_URLS = 200;

const TEST_ENV = process.env.TEST_ENV;
const envs = TEST_ENV
  ? { [TEST_ENV]: ALL_ENVIRONMENTS[TEST_ENV] }
  : ALL_ENVIRONMENTS;

const locsFrom = (xml) =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

/** Runs `worker` over `items`, at most CONCURRENCY at a time. */
async function pooled(items, worker) {
  const results = [];
  let next = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * `redirect: 'manual'` so a 301 or 308 is reported as itself. Following them
 * would let a URL that only works via a redirect pass as a live canonical
 * page, which is not what a sitemap should contain.
 */
async function status(url) {
  const res = await fetch(url, probeInit({ redirect: 'manual' }));
  await res.body?.cancel();
  return res.status;
}

for (const [env, host] of Object.entries(envs)) {
  describe(`sitemap (${env})`, () => {
    if (env !== 'production') {
      test('no sitemap is published, because this build sets noIndex', async () => {
        const res = await fetch(`${host}${SITEMAP_PATH}`, probeInit({ redirect: 'manual' }));
        await res.body?.cancel();
        assert.equal(
          res.status,
          404,
          `${host}${SITEMAP_PATH} answered ${res.status}. A noIndex build should ` +
            'publish no sitemap; if noIndex was dropped, this host is now offering ' +
            'a crawler a second set of URLs for the same pages.'
        );
      });
      return;
    }

    let locs;

    test('the sitemap is published and lists pages', async () => {
      const res = await fetch(`${host}${SITEMAP_PATH}`, probeInit({ redirect: 'manual' }));
      assert.equal(res.status, 200, `${host}${SITEMAP_PATH} answered ${res.status}`);
      locs = locsFrom(await res.text());
      assert.ok(
        locs.length >= MINIMUM_URLS,
        `sitemap lists ${locs.length} URL(s), fewer than the ${MINIMUM_URLS} ` +
          'expected. Either most of the site stopped building, or the sitemap is ' +
          'empty -- in which case the next test would pass while checking nothing.'
      );
    });

    test('every URL in the sitemap answers 200', async () => {
      assert.ok(locs && locs.length > 0, 'no URLs were read from the sitemap');

      const statuses = await pooled(locs, async (loc) => {
        try {
          return { loc, status: await status(loc) };
        } catch (err) {
          return { loc, status: `error: ${err.message}` };
        }
      });

      const dead = statuses.filter((s) => s.status !== 200);
      const detail = dead.map((d) => `    ${d.status}  ${d.loc}`).join('\n');

      assert.equal(
        dead.length,
        0,
        `${dead.length} of ${locs.length} sitemap URL(s) do not answer 200:\n${detail}\n\n` +
          '  The sitemap tells Google to crawl these. A 404 on a URL we advertised\n' +
          '  is worse than one we never mentioned. See #188.'
      );

      console.log(`  ${locs.length} of ${locs.length} sitemap URL(s) answered 200`);
    });
  });
}
