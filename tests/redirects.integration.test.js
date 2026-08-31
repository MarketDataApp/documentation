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
 * BOTH SLASH FORMS ARE TESTED, and that gap is why a regression shipped. The
 * suite originally probed only `<from>/`. Cloudflare normalises a bare path to
 * its slashed form only when a DIRECTORY exists there, and dropping
 * @docusaurus/plugin-client-redirects removed the stub pages that were
 * providing those directories -- so all 18 bare forms went from working to a
 * flat 404 on both hosts while every test stayed green.
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
const { REDIRECTS, SDK_PHP } = require('../redirects');

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
      const toUrl = `${host}${PREFIX}${to}/`;

      // Both spellings, because they are separate rules in _redirects and a
      // missing one fails silently -- the other keeps working, so nothing
      // reports it. `slashed` is the canonical form; `bare` is what somebody
      // typed or an old link carries.
      for (const [label, fromUrl] of [
        ['bare', `${host}${PREFIX}${from}`],
        ['slashed', `${host}${PREFIX}${from}/`],
      ]) {
        test(`GET ${from} (${label}) -> ${to}`, async () => {
          const res = await fetch(fromUrl, { redirect: 'manual' });
          assert.equal(res.status, 301, `${label} ${from} returned ${res.status}`);
          assert.equal(resolve(res.headers.get('location'), fromUrl), toUrl);
        });

        // Identical expectations to GET -- that is the whole claim.
        test(`HEAD ${from} (${label}) -> ${to}`, async () => {
          const res = await fetch(fromUrl, { method: 'HEAD', redirect: 'manual' });
          assert.equal(res.status, 301, `HEAD ${label} ${from} returned ${res.status}`);
          assert.equal(resolve(res.headers.get('location'), fromUrl), toUrl);
        });
      }

      test(`destination ${to} exists`, async () => {
        const res = await fetch(toUrl, { redirect: 'manual' });
        assert.equal(res.status, 200, `destination ${to} returned ${res.status}`);
      });
    }

    // --- the legacy PHP SDK space ---------------------------------------
    //
    // These left the edge worker and became _redirects rules when the worker
    // was retired (MarketData-App/www-marketdata-app#15). The worker was the
    // only thing answering them, so an ordering mistake here does not degrade
    // a behaviour -- it 404s every inbound link the outside world still holds.
    //
    // THE ORDERING IS THE THING UNDER TEST. `/docs/sdk-php/*` matches a
    // doubled path just as well as a plain one, and Cloudflare takes the first
    // rule that matches. If the collapse rules ever sort below the catch-all,
    // every plain URL keeps working and only the doubled ones break -- silent,
    // and invisible to anyone spot-checking a normal link.
    describe('legacy PHP SDK', () => {
      const { source, target, doubledPrefixes } = SDK_PHP;

      for (const dir of doubledPrefixes) {
        const doubled = `${host}${PREFIX}${source}/${dir}/${dir}/Example.html`;
        const expected = `${target}/${dir}/Example.html`;

        // Named for what breaks: the doubling must be gone from Location.
        test(`GET ${dir}/${dir}/ collapses to ${dir}/`, async () => {
          const res = await fetch(doubled, { redirect: 'manual' });
          assert.equal(res.status, 301, `${dir} doubled returned ${res.status}`);
          assert.equal(resolve(res.headers.get('location'), doubled), expected);
        });

        test(`HEAD ${dir}/${dir}/ collapses to ${dir}/`, async () => {
          const res = await fetch(doubled, { method: 'HEAD', redirect: 'manual' });
          assert.equal(res.status, 301, `HEAD ${dir} doubled returned ${res.status}`);
          assert.equal(resolve(res.headers.get('location'), doubled), expected);
        });

        // The plain form must survive the collapse rule sitting above it.
        test(`GET ${dir}/ passes through undoubled`, async () => {
          const plain = `${host}${PREFIX}${source}/${dir}/Example.html`;
          const res = await fetch(plain, { redirect: 'manual' });
          assert.equal(res.status, 301, `${dir} plain returned ${res.status}`);
          assert.equal(
            resolve(res.headers.get('location'), plain),
            `${target}/${dir}/Example.html`
          );
        });
      }

      // Both slash forms of the root, for the reason given at the top of this
      // file: Cloudflare normalises a bare path only when a directory exists
      // there, and none is built for this space.
      for (const [label, url] of [
        ['bare', `${host}${PREFIX}${source}`],
        ['slashed', `${host}${PREFIX}${source}/`],
      ]) {
        test(`GET root (${label}) -> GitHub Pages`, async () => {
          const res = await fetch(url, { redirect: 'manual' });
          assert.equal(res.status, 301, `root ${label} returned ${res.status}`);
          assert.equal(resolve(res.headers.get('location'), url), `${target}/`);
        });
      }

      // A deep path with no doubling, proving the catch-all still carries the
      // whole remainder rather than truncating at the first segment.
      test('GET deep path keeps its full subpath', async () => {
        const deep = `${host}${PREFIX}${source}/a/b/c.html`;
        const res = await fetch(deep, { redirect: 'manual' });
        assert.equal(res.status, 301, `deep path returned ${res.status}`);
        assert.equal(resolve(res.headers.get('location'), deep), `${target}/a/b/c.html`);
      });
    });
  });
}
