'use strict';

/**
 * Integration test: verifies every client-side redirect declared in
 * docusaurus.config.js works on the live site.
 *
 * Redirects are extracted from the config rather than restated here, so adding
 * one to the config adds a test case and the two cannot drift.
 *
 * ---------------------------------------------------------------------------
 * Why this file is here and not in worker/
 * ---------------------------------------------------------------------------
 *
 * It used to live in worker/, which moved to MarketDataApp/www-marketdata-app.
 * It did not go with it: it reads ../docusaurus.config.js and tests this repo's
 * redirect declarations. The worker only converts the stubs Docusaurus emits
 * for them.
 *
 * Rewritten from vitest to node:test in the same change. vitest was worker/'s
 * devDependency and left with it, and this repo already runs `node --test` for
 * lib/ and scripts/. Adding vitest back to the root for one file would have
 * re-introduced GHSA-5xrq-8626-4rwp, which deleting worker/ removes.
 *
 * The assertions are a faithful port -- same three checks, same order.
 *
 * ONE NOTE ON `html.includes(to)`. It was written when a stub was served as a
 * page carrying a <meta http-equiv="refresh"> to `to`, so the check read the
 * refresh target out of the body. Since MarketDataApp/documentation@179ee28 the
 * edge worker converts those stubs to real 301s, so fetch() now follows the
 * redirect and this asserts against the DESTINATION page, which contains its
 * own URL. It still passes, for a different reason than the one it was written
 * for. Left as-is deliberately: changing what a test means during a move makes
 * a later failure impossible to attribute. Worth revisiting on its own.
 *
 * Set TEST_ENV=staging or TEST_ENV=production for one host. Unset tests both.
 *
 * Run with: yarn test:redirects
 * Requires network access to www.marketdata.app and www-staging.marketdata.app.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ALL_ENVIRONMENTS = {
  staging: 'https://www-staging.marketdata.app/docs',
  production: 'https://www.marketdata.app/docs',
};

const TEST_ENV = process.env.TEST_ENV;
const envs = TEST_ENV
  ? { [TEST_ENV]: ALL_ENVIRONMENTS[TEST_ENV] }
  : ALL_ENVIRONMENTS;

/**
 * Parses the redirects array out of docusaurus.config.js so the test stays in
 * step with the config without anyone updating it by hand.
 */
function extractRedirects() {
  const configPath = resolve(__dirname, '..', 'docusaurus.config.js');
  const configText = readFileSync(configPath, 'utf-8');

  const redirectsMatch = configText.match(/redirects:\s*\[([\s\S]*?)\]\s*,?\s*\}/);
  if (!redirectsMatch) throw new Error('Could not find redirects in docusaurus.config.js');

  const redirects = [];
  const pattern = /\{\s*from:\s*"([^"]+)"\s*,\s*to:\s*"([^"]+)"\s*,?\s*\}/g;
  let match;
  while ((match = pattern.exec(redirectsMatch[1]))) {
    redirects.push({ from: match[1], to: match[2] });
  }

  return redirects;
}

const redirects = extractRedirects();

for (const [env, baseUrl] of Object.entries(envs)) {
  describe(`client-side redirects (${env})`, () => {
    test('found redirects to test', () => {
      assert.ok(redirects.length > 0, 'no redirects parsed from docusaurus.config.js');
    });

    for (const { from, to } of redirects) {
      test(`${from} -> ${to}`, async () => {
        const fromRes = await fetch(`${baseUrl}${from}`);
        assert.equal(fromRes.status, 200, `${from} returned ${fromRes.status}`);

        const html = await fromRes.text();
        assert.ok(
          html.includes(to),
          `${from} page does not contain redirect to ${to}`
        );

        // Verify the destination actually exists.
        const toRes = await fetch(`${baseUrl}${to}`);
        assert.equal(toRes.status, 200, `destination ${to} returned ${toRes.status}`);
      });
    }
  });
}
