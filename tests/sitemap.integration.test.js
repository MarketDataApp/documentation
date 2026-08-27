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
 * Run with: yarn test:sitemap
 * Requires network access to www.marketdata.app and www-staging.marketdata.app.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

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
  const res = await fetch(url, { redirect: 'manual' });
  await res.body?.cancel();
  return res.status;
}

for (const [env, host] of Object.entries(envs)) {
  describe(`sitemap (${env})`, () => {
    if (env !== 'production') {
      test('no sitemap is published, because this build sets noIndex', async () => {
        const res = await fetch(`${host}${SITEMAP_PATH}`, { redirect: 'manual' });
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
      const res = await fetch(`${host}${SITEMAP_PATH}`, { redirect: 'manual' });
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
