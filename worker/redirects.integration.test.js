/**
 * Integration test: verifies all client-side redirects defined in
 * docusaurus.config.js work correctly on both staging and production.
 *
 * Redirects are extracted dynamically from the config, so adding a new
 * redirect automatically adds a new test case.
 *
 * Run with: yarn test:integration
 * Requires network access to www.marketdata.app
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ENVIRONMENTS = {
  production: 'https://www.marketdata.app/docs',
  staging: 'https://www.marketdata.app/docs-staging',
};

/**
 * Parses the redirects array from docusaurus.config.js so the test
 * stays in sync with the config without manual updates.
 */
function extractRedirects() {
  const configPath = resolve(import.meta.dirname, '..', 'docusaurus.config.js');
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

for (const [env, baseUrl] of Object.entries(ENVIRONMENTS)) {
  describe(`client-side redirects (${env})`, () => {
    it('found redirects to test', () => {
      expect(redirects.length).toBeGreaterThan(0);
    });

    for (const { from, to } of redirects) {
      it(`${from} → ${to}`, async () => {
        const fromRes = await fetch(`${baseUrl}${from}`);
        expect(fromRes.status, `${from} returned ${fromRes.status}`).toBe(200);

        const html = await fromRes.text();
        // Docusaurus client-redirects generates pages with meta refresh / JS redirect
        expect(html, `${from} page does not contain redirect to ${to}`).toContain(to);

        // Verify destination actually exists
        const toRes = await fetch(`${baseUrl}${to}`);
        expect(toRes.status, `destination ${to} returned ${toRes.status}`).toBe(200);
      });
    }
  });
}
