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

/**
 * A video embed keeps its shape at every width.
 *
 * Making the width fluid to stop the sideways scroll was half a fix: the
 * height attribute stayed a fixed pixel value, so the frame stretched to 2.61:1
 * and YouTube pillarboxed the video inside it with black bars either side. The
 * three embeds that had been made fluid long before were 1.64:1 for the same
 * reason, so this had never been right on any of them.
 *
 * Nothing else can see it. The page is valid, nothing overflows, the link
 * checker is happy -- only the picture is the wrong shape, and only at a
 * rendered width.
 */
const EMBED_PAGES = ['/api/', '/sheets/', '/sheets/options/optionchain/'];

for (const vp of WIDTHS) {
  for (const path of EMBED_PAGES) {
    test(`video embeds are 16:9 at ${vp.name} width on ${path}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });

      const frames = await page.evaluate(() =>
        [...document.querySelectorAll('iframe')]
          .filter((f) => /youtube(-nocookie)?\.com\/embed/.test(f.src))
          .map((f) => {
            const b = f.getBoundingClientRect();
            return { w: Math.round(b.width), h: Math.round(b.height), ratio: b.width / b.height };
          })
      );

      expect(frames.length, 'no YouTube embed found -- this test would pass vacuously').toBeGreaterThan(0);

      for (const f of frames) {
        expect(
          Math.abs(f.ratio - 16 / 9),
          `embed is ${f.w}x${f.h} (${f.ratio.toFixed(2)}:1), not 16:9. A fixed pixel ` +
            'height cannot hold a ratio against a fluid width -- use aspect-ratio.'
        ).toBeLessThan(0.05);
      }
    });
  }
}
