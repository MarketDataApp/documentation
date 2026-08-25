'use strict';

/**
 * Integration test: verifies every redirect in redirects.js works on the live
 * site, for GET and for HEAD.
 *
 * ---------------------------------------------------------------------------
 * What changed, and why the assertions are stronger now
 * ---------------------------------------------------------------------------
 *
 * These used to be Docusaurus client-redirect stubs: a page carrying
 * `<meta http-equiv="refresh">`, answering 200, with the edge worker reading
 * the body and converting it to a 301. So the old assertions could only be
 * "the page loads, and the HTML mentions the destination". They are now real
 * `_redirects` rules served by Cloudflare Pages, so this asserts what actually
 * matters: the status is 301 and Location names the destination.
 *
 * HEAD IS TESTED, and that is the point of the exercise. The old arrangement
 * could not work for HEAD -- a HEAD response has no body, so the worker's
 * match never fired and every one of these answered 301 to GET and 200 to
 * HEAD. Nothing caught it, because every test here used GET. See
 * MarketDataApp/www-marketdata-app#2.
 *
 * `redirect: 'manual'` throughout. Following the redirect is what hid the
 * defect: fetch chased the 301 to a destination that returns 200, so a test
 * asserting 200 passed whether or not a redirect had happened at all.
 *
 * The redirect list is imported rather than parsed out of docusaurus.config.js
 * with a regular expression, so adding one to redirects.js adds a test case and
 * the two cannot drift.
 *
 * Set TEST_ENV=staging or TEST_ENV=production for one host. Unset tests both.
 *
 * Run with: yarn test:redirects
 * Requires network access to www.marketdata.app and www-staging.marketdata.app.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { REDIRECTS } = require('../redirects');

const ALL_ENVIRONMENTS = {
  staging: 'https://www-staging.marketdata.app',
  production: 'https://www.marketdata.app',
};

const PREFIX = '/docs';

const TEST_ENV = process.env.TEST_ENV;
const envs = TEST_ENV
  ? { [TEST_ENV]: ALL_ENVIRONMENTS[TEST_ENV] }
  : ALL_ENVIRONMENTS;

/**
 * Cloudflare emits a relative Location, which is why one rule serves both
 * hosts. Resolve it against the request so the assertion reads as a URL.
 */
const resolve = (location, requestUrl) => new URL(location, requestUrl).href;

for (const [env, host] of Object.entries(envs)) {
  describe(`redirects (${env})`, () => {
    test('found redirects to test', () => {
      assert.ok(REDIRECTS.length > 0, 'redirects.js is empty');
    });

    for (const { from, to } of REDIRECTS) {
      const fromUrl = `${host}${PREFIX}${from}/`;
      const toUrl = `${host}${PREFIX}${to}/`;

      test(`GET ${from} -> ${to}`, async () => {
        const res = await fetch(fromUrl, { redirect: 'manual' });
        assert.equal(res.status, 301, `${from} returned ${res.status}`);
        assert.equal(resolve(res.headers.get('location'), fromUrl), toUrl);
      });

      // The case the old suite could not express. Identical expectations to
      // GET -- that is the whole claim.
      test(`HEAD ${from} -> ${to}`, async () => {
        const res = await fetch(fromUrl, { method: 'HEAD', redirect: 'manual' });
        assert.equal(res.status, 301, `HEAD ${from} returned ${res.status}`);
        assert.equal(resolve(res.headers.get('location'), fromUrl), toUrl);
      });

      test(`destination ${to} exists`, async () => {
        const res = await fetch(toUrl, { redirect: 'manual' });
        assert.equal(res.status, 200, `destination ${to} returned ${res.status}`);
      });
    }
  });
}
