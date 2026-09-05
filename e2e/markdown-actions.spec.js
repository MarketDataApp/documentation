/**
 * The metadata row under each doc's h1: last-updated date, Copy as Markdown,
 * View as Markdown. See src/theme/DocItem/MarkdownActions/index.js.
 *
 * Every assertion here covers something that fails quietly in production:
 *
 *   - The DATE comes from git history at build time. Under a shallow clone
 *     Docusaurus reports the same date for every page and says nothing, so the
 *     row still renders and still looks right. This asserts two pages carry
 *     DIFFERENT dates, which is the only cheap way to see that from outside.
 *   - The COPY button fetches the Markdown twin. A host that answers 200 with
 *     an error page would put that on the clipboard under a "Copied" label, so
 *     the copied bytes are compared against the twin rather than merely being
 *     non-empty.
 *   - The LINK is a plain <a href>, which Docusaurus's broken-link check does
 *     not walk. `markdown-twins.js` fails the build when a route has no twin,
 *     but nothing downstream re-checks that the URL this control names is the
 *     one that got written.
 *   - The HOVER colour comes from a CSS variable. `--ifm-heading-color` is not
 *     declared on :root, so `var()` on it is invalid, `color` computes to
 *     `unset`, and since colour inherits, the control silently keeps its
 *     resting colour. The rule still matches and its `text-decoration` still
 *     applies, so nothing looks broken from the stylesheet's side.
 *   - The DATE METADATA is invisible by definition. Three spellings have to
 *     agree with each other and with the page's canonical URL.
 *
 * Run with: TEST_ENV=staging pnpm run test:e2e
 */
import { test, expect } from '@playwright/test';

// TEST_BASE_URL points the suite at a local `pnpm run build` served under /docs/,
// so the row can be proved before it is deployed rather than after. Without it
// the suite behaves like context7-widget.spec.js: staging or production.
const BASE_URL = process.env.TEST_BASE_URL
  || (process.env.TEST_ENV === 'staging'
    ? 'https://www-staging.marketdata.app/docs'
    : 'https://www.marketdata.app/docs');

// Two pages that are edited on different days, so their dates should differ.
const PAGES = ['/api/options/chain', '/api/authentication'];

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

for (const path of PAGES) {
  test(`markdown actions row renders on ${path}`, async ({ page }) => {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });

    // Sits under the h1, not in the footer or the breadcrumbs.
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();

    await expect(page.getByText(/^Last updated /)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy as Markdown' })).toBeVisible();

    const link = page.getByRole('link', { name: 'View as Markdown' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', `${new URL(BASE_URL).pathname}${path}/index.md`.replace(/\/{2,}/g, '/'));
  });
}

test('copy button puts the page\'s Markdown twin on the clipboard', async ({ page }) => {
  const path = '/api/options/chain';
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });

  const button = page.getByRole('button', { name: 'Copy as Markdown' });
  const before = await button.boundingBox();

  await button.click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible({ timeout: 10_000 });

  // The four states share one grid cell so the row never moves under the
  // reader's cursor. A width change here means that broke.
  const after = await page.getByRole('button', { name: 'Copied' }).boundingBox();
  expect(after.width).toBeCloseTo(before.width, 1);

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.startsWith('# ')).toBe(true);

  const twin = await (await page.request.get(`${BASE_URL}${path}/index.md`)).text();
  expect(copied).toBe(twin);
});

test('the last-updated date is per page, not one build date', async ({ page }) => {
  const dates = [];
  for (const path of PAGES) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
    dates.push(await page.getByText(/^Last updated /).innerText());
  }
  // Identical dates on two pages with different edit histories is the
  // signature of a shallow clone at build time.
  expect(dates[0]).not.toBe(dates[1]);
});

test('the link underlines on hover and not before', async ({ page }) => {
  await page.goto(`${BASE_URL}/api/options/chain`, { waitUntil: 'domcontentloaded' });

  for (const item of [
    page.getByRole('link', { name: 'View as Markdown' }),
    page.getByRole('button', { name: 'Copy as Markdown' }),
  ]) {
    const rest = await item.evaluate((el) => ({
      deco: getComputedStyle(el).textDecorationLine,
      color: getComputedStyle(el).color,
    }));
    expect(rest.deco).toBe('none');

    await item.hover();
    const hover = await item.evaluate((el) => ({
      deco: getComputedStyle(el).textDecorationLine,
      color: getComputedStyle(el).color,
    }));
    expect(hover.deco).toBe('underline');
    // A colour that does not move is the signature of an undefined CSS
    // variable, which is how this shipped the first time.
    expect(hover.color).not.toBe(rest.color);

    await page.mouse.move(0, 0);
  }
});

test('the three items sit on one baseline', async ({ page }) => {
  // The date rendered 2px above the two controls, on every doc page, in both
  // themes. Nothing in this row's own CSS was wrong: it is built from <li>
  // inside the markdown body, so Infima's `.markdown li + li { margin-top }`
  // gave the SECOND and THIRD items a 4px top margin and, being an
  // adjacent-sibling rule, could not give one to the first. The flex line grew
  // to the tallest margin box and centred the unmargined date inside it.
  //
  // No unit test can see this and reading the stylesheet does not reveal it --
  // every item has identical height, padding, font-size and line-height. Only
  // measuring the rendered boxes does, so that is what this asserts.
  //
  // A wide viewport on purpose: the row wraps below 640px by design, and a
  // wrapped row legitimately has items on different lines.
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(`${BASE_URL}/api/options/chain`, { waitUntil: 'domcontentloaded' });

  const tops = await page.evaluate(() => {
    const list = document.querySelector('ul[class*="list_"]');
    return [...list.children].map((li) => Math.round(li.getBoundingClientRect().top));
  });

  expect(tops.length).toBe(3);
  // One line, so one top. Rounded to the pixel: sub-pixel layout differences
  // are not what this is looking for; a 4px margin on two of three items is.
  expect(new Set(tops).size).toBe(1);
});

test('the last-updated date is machine readable', async ({ page }) => {
  await page.goto(`${BASE_URL}/api/options/chain`, { waitUntil: 'domcontentloaded' });

  const iso = await page.locator('time').first().getAttribute('datetime');
  expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);

  const og = await page.locator('meta[property="article:modified_time"]').getAttribute('content');
  expect(og).toBe(iso);

  // textContent, not innerText: a <script> renders no text, so innerText is
  // empty and JSON.parse fails on it.
  const ld = JSON.parse(
    await page.locator('script[type="application/ld+json"]').evaluate((el) => el.textContent),
  );
  expect(ld['@type']).toBe('TechArticle');
  expect(ld.dateModified).toBe(iso);

  // The JSON-LD must name the same URL as the canonical, or it describes a
  // second page. The site uses trailingSlash: true and `permalink` does not.
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  expect(ld.url).toBe(canonical);
});

test('a failed fetch reports failure and copies nothing', async ({ page }) => {
  // A host answering 200 with an error page is the case the "# " guard exists
  // for: without it the button says "Copied" and the clipboard holds markup.
  await page.route('**/index.md', (route) =>
    route.fulfill({ status: 200, body: '<div id="app">Page not found</div>' }));

  await page.goto(`${BASE_URL}/api/options/chain`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Copy as Markdown' }).click();

  await expect(page.getByRole('button', { name: 'Copy failed' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('status')).toContainText('View as Markdown');

  const copied = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  expect(copied).not.toContain('Page not found');
});
