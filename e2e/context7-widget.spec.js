/**
 * Smoke test: verifies the Context7 chat widget loads and renders
 * the expected DOM structure on pages where it should appear.
 *
 * Catches breaking changes from Context7 (renamed classes, removed
 * shadow DOM, changed container IDs, script load failures, etc.).
 *
 * Run with: yarn test:e2e
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_ENV === 'staging'
  ? 'https://www-staging.marketdata.app/docs'
  : 'https://www.marketdata.app/docs';

// One representative page per widget configuration.
const WIDGET_PAGES = [
  { path: '/api', name: 'API' },
  { path: '/sheets', name: 'Sheets' },
  { path: '/sdk/py', name: 'Python SDK' },
  { path: '/sdk/go', name: 'Go SDK' },
  { path: '/sdk/php', name: 'PHP SDK' },
];

for (const { path, name } of WIDGET_PAGES) {
  test(`Context7 widget loads on ${name} page (${path})`, async ({ page }) => {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });

    // 1. Widget script tag should be injected.
    const script = page.locator('#context7-widget-script');
    await expect(script).toBeAttached({ timeout: 10_000 });

    // 2. Widget container should appear.
    const container = page.locator('#context7-widget');
    await expect(container).toBeAttached({ timeout: 15_000 });

    // 3. Shadow DOM should be created with the expected panel structure.
    const hasPanel = await container.evaluate((el) => {
      const sr = el.shadowRoot;
      if (!sr) return false;
      return sr.querySelector('.c7-panel') !== null;
    });
    expect(hasPanel, 'Shadow DOM missing .c7-panel element').toBe(true);
  });
}
