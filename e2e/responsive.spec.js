// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * No page may scroll sideways.
 *
 * ---------------------------------------------------------------------------
 * Why this needs a browser
 * ---------------------------------------------------------------------------
 *
 * Horizontal overflow is invisible to every other check in this repo. The HTML
 * is valid, the build is green, the link checker is happy, and `lint:seo` reads
 * the head. It shows up only when something is laid out at a width, and only at
 * SOME widths -- which is why this runs at a phone width as well as a desktop
 * one.
 *
 * It was found by sweeping staging after the 3.10 upgrade: `/docs/api/` was
 * 186px wider than a 390px viewport because one YouTube embed had kept
 * YouTube's default `width="560"`, while the docs' three other embeds had been
 * changed to `width="100%"` at some point. Every page on that route scrolled
 * sideways on a phone, and had for as long as the video had been there.
 *
 * ---------------------------------------------------------------------------
 * What "overflow" means here, and what it deliberately excludes
 * ---------------------------------------------------------------------------
 *
 * A code block, a wide table and a Mermaid diagram are all SUPPOSED to be wider
 * than the column -- they scroll inside their own container. So an element
 * wider than the viewport is only a fault when nothing between it and the root
 * can scroll. The assertion is therefore made on the DOCUMENT: if
 * `scrollWidth` exceeds `clientWidth`, something escaped its container and the
 * reader gets a sideways page.
 *
 * Run with: TEST_ENV=staging pnpm run test:e2e
 */

const BASE_URL =
  process.env.TEST_BASE_URL ||
  (process.env.TEST_ENV === 'staging'
    ? 'https://www-staging.marketdata.app/docs'
    : 'https://www.marketdata.app/docs');

/**
 * One page per shape rather than per section: an embed, a wide table, long code
 * samples, a hub of cards, and the docs root. Overflow comes from a KIND of
 * content, so covering the kinds beats covering the routes.
 */
const PAGES = [
  '/',
  '/api/', // the YouTube embed that started this
  '/api/stocks/candles/', // language tabs and long request URLs
  '/api/universal-parameters/columns/', // wide tables
  '/sheets/options/optionchain/', // a second embed, already fluid
  '/sdk/js/client/', // long TypeScript signatures
  '/account/plans/', // pricing tables
];

// 390px is an iPhone 12/13/14 in CSS pixels -- narrow enough to catch a fixed
// 560px embed, and a width real readers actually use.
const WIDTHS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const vp of WIDTHS) {
  for (const path of PAGES) {
    test(`no sideways scroll at ${vp.name} width on ${path}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });

      const overflow = await page.evaluate(() => {
        const de = document.documentElement;
        return de.scrollWidth - de.clientWidth;
      });

      // A pixel of slack: sub-pixel layout rounding is not what this looks for.
      expect(
        overflow,
        `the document is ${overflow}px wider than the ${vp.width}px viewport, so the page ` +
          'scrolls sideways. Something is escaping its container -- usually a fixed-width ' +
          'embed, image or table. Wide content must scroll inside its own box, not the page.'
      ).toBeLessThanOrEqual(1);
    });
  }
}
