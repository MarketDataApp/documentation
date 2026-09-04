'use strict';

/**
 * Self-tests for scripts/lint-seo.js.
 *
 * Two things every rule here is written to prove, and the second is the one
 * that usually goes missing:
 *
 *   1. a correct corpus passes
 *   2. a violated rule FAILS — a gate that cannot fail is not a gate, and the
 *      only way to know is to feed it the violation
 *
 * The minified fixture is not decoration. The sibling check in
 * MarketDataApp/website read every built page as having no robots tag, because
 * its minifier writes attributes unquoted and reordered and the matcher
 * required quotes. It passed against a dev server and failed in CI. A
 * quoted-only fixture passes forever, so there is one here that quotes nothing.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT = path.resolve(__dirname, '..', 'lint-seo.js');

const PROD = 'https://www.marketdata.app';
const STAGING = 'https://www-staging.marketdata.app';

/** A well-formed page. Override any field to violate exactly one rule. */
function page(route, o = {}) {
  const url = `${o.host ?? PROD}/docs${route}`;
  const parts = [];
  parts.push(`<meta charset="utf-8">`);
  parts.push(`<meta name="viewport" content="width=device-width">`);
  // `suffix` is what Docusaurus appends, which differs by environment: see
  // SITE_SUFFIX_STAGING in the checker. Only the I1 tests set it.
  if (o.title !== null) parts.push(`<title>${o.title ?? 'A Page'} | ${o.suffix ?? 'Market Data'}</title>`);
  if (o.extraTitle) parts.push(`<title>Second</title>`);
  if (o.description !== null) {
    parts.push(`<meta name="description" content="${o.description ?? 'A description long enough to be a real one for the purposes of this fixture.'}">`);
  }
  if (o.canonical !== null) parts.push(`<link rel="canonical" href="${o.canonical ?? url}">`);
  if (o.extraCanonical) parts.push(`<link rel="canonical" href="${url}?x">`);
  if (o.ogUrl !== null) parts.push(`<meta property="og:url" content="${o.ogUrl ?? o.canonical ?? url}">`);
  if (o.alternate) parts.push(`<link rel="alternate" href="${url}" hreflang="en">`);
  if (o.ogDescription) parts.push(`<meta property="og:description" content="${o.ogDescription}">`);
  if (o.robots) parts.push(`<meta name="robots" content="${o.robots}">`);
  if (o.jsonLd) parts.push(`<script type="application/ld+json">${o.jsonLd}</script>`);
  const body = `<article><h1>A Page</h1>${o.extraH1 ? '<h1>Another</h1>' : ''}${o.body ?? ''}</article>`;
  return `<!DOCTYPE html><html lang="${o.lang ?? 'en'}"><head>${parts.join('')}</head><body>${body}</body></html>`;
}

/** Build a throwaway build/ and run the checker over it. */
function run(pages, opts = {}) {
  const { sitemap, args = [] } = opts;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-'));
  for (const [route, html] of Object.entries(pages)) {
    const file = route === '/404.html'
      ? path.join(dir, '404.html')
      : path.join(dir, route.replace(/^\//, ''), 'index.html');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html, 'utf8');
  }
  if (opts.twins !== false) {
    // Every route gets its Markdown twin unless a test suppresses it, so rule
    // G1 is satisfied by default and only the test that targets it sees it.
    for (const route of Object.keys(pages)) {
      if (route === '/404.html') continue;
      fs.writeFileSync(path.join(dir, route.replace(/^\//, ''), 'index.md'), '# Twin\n', 'utf8');
    }
  }
  if (opts.llms) {
    fs.writeFileSync(path.join(dir, 'llms.txt'), opts.llms, 'utf8');
    fs.writeFileSync(path.join(dir, 'llms-full.txt'), opts.llms, 'utf8');
  }
  if (sitemap) {
    const locs = sitemap.map((p) => `<url><loc>${PROD}/docs${p}</loc></url>`).join('');
    fs.writeFileSync(path.join(dir, 'sitemap.xml'), `<urlset>${locs}</urlset>`, 'utf8');
  }
  try {
    return { code: 0, out: execFileSync('node', [SCRIPT, '--dir', dir, ...args], { encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status, out: `${e.stdout || ''}${e.stderr || ''}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** A minimal valid production corpus: one content page, listed in the sitemap. */
const OK = { pages: { '/api/thing/': page('/api/thing/') }, sitemap: ['/api/thing/'] };

test('a correct production corpus passes', () => {
  const r = run(OK.pages, { sitemap: OK.sitemap });
  assert.strictEqual(r.code, 0, r.out);
  assert.match(r.out, /Every gated rule passed/);
  assert.match(r.out, /environment {4}production/);
});

test('unquoted, reordered, minified attributes are read correctly', () => {
  // Nothing here is quoted and the attribute order is inverted. A regex
  // matcher requiring `name="robots"` reads this as having no robots tag,
  // which is indistinguishable from a page that has none.
  const minified =
    '<!DOCTYPE html><html lang=en><head>' +
    '<meta charset=utf-8><meta content=width=device-width name=viewport>' +
    '<title>A Page | Market Data</title>' +
    '<meta content="A description long enough to be a real one for this fixture and then some." name=description>' +
    // No canonical: this page says noindex, and C1 forbids the pair. The
    // unquoted-attribute coverage this fixture exists for is carried by the
    // robots, viewport and description tags around it, and by the sibling test
    // below, which puts an unquoted canonical back and requires C1 to see it.
    `<meta content=${PROD}/docs/api/thing/ property=og:url>` +
    '<meta content=noindex,nofollow name=robots>' +
    '</head><body><article><h1>A Page</h1></article></body></html>';
  // noindex + absent from the sitemap is the consistent pairing, so if the
  // robots tag is READ this passes; if it is missed, D2 fails the page for
  // being indexable and absent from the sitemap.
  const r = run({ '/api/thing/': minified }, { sitemap: [] });
  assert.strictEqual(r.code, 0, r.out);
  assert.match(r.out, /1 page\(s\) noindex/);
});

test('A1 fails when a page has no title', () => {
  const r = run({ '/api/thing/': page('/api/thing/', { title: null }) }, { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /A1.*no <title>/);
});

test('A1 fails on two titles', () => {
  const r = run({ '/api/thing/': page('/api/thing/', { extraTitle: true }) }, { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /A1.*more than one <title>/);
});

test('A2 fails when <html> has no lang', () => {
  const r = run({ '/api/thing/': page('/api/thing/', { lang: '' }) }, { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /A2.*lang/);
});

test('B1 fails when a content page has no description', () => {
  const r = run({ '/api/thing/': page('/api/thing/', { description: null }) }, { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /B1.*no description/);
});

test('B1 exempts navigation artifacts, using the classifier llms-txt already exports', () => {
  const r = run({
    '/api/thing/': page('/api/thing/'),
    // Distinct titles, because H1 is gated: three pages all titled "A Page"
    // would fail the run on a rule this test is not about.
    '/api/tags/': page('/api/tags/', { title: 'Tags', description: null }),
    '/search/': page('/search/', { title: 'Search', description: null }),
  }, { sitemap: ['/api/thing/', '/api/tags/', '/search/'] });
  assert.strictEqual(r.code, 0, r.out);
});

test('C1 fails when a page has no canonical', () => {
  const r = run({ '/api/thing/': page('/api/thing/', { canonical: null }) }, { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /C1.*no canonical/);
});

test('C1 fails when a noindex page still emits a canonical', () => {
  // Google's guidance is that the two must not be combined, and the site did
  // combine them: every page of a staging build carried a canonical naming
  // www-staging while also saying noindex. plugins/noindex-head.js strips them;
  // this is the gate that says so.
  const r = run({
    '/api/thing/': page('/api/thing/', { robots: 'noindex, nofollow' }),
  }, { sitemap: [] });
  assert.strictEqual(r.code, 1, r.out);
  assert.match(r.out, /C1.*noindex pages that still emit a canonical/);
});

test('C1 reads an UNQUOTED canonical on a noindex page', () => {
  // The half the minified fixture above gave up when its canonical came out.
  // A matcher that misses this reports a clean page, which is the silent
  // direction.
  const minified =
    '<!DOCTYPE html><html lang=en><head>' +
    '<meta charset=utf-8><meta content=width=device-width name=viewport>' +
    '<title>A Page | Market Data</title>' +
    '<meta content="A description long enough to be a real one for this fixture and then some." name=description>' +
    `<link href=${PROD}/docs/api/thing/ rel=canonical>` +
    `<meta content=${PROD}/docs/api/thing/ property=og:url>` +
    '<meta content=noindex,nofollow name=robots>' +
    '</head><body><article><h1>A Page</h1></article></body></html>';
  const r = run({ '/api/thing/': minified }, { sitemap: [] });
  assert.strictEqual(r.code, 1, r.out);
  assert.match(r.out, /C1.*noindex pages that still emit a canonical/);
});

test('C1 fails on two canonicals', () => {
  const r = run({ '/api/thing/': page('/api/thing/', { extraCanonical: true }) }, { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /C1.*more than one canonical/);
});

test('C2 fails when the canonical names another page', () => {
  const r = run({
    '/api/thing/': page('/api/thing/', { canonical: `${PROD}/docs/api/other/` }),
  }, { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /C2.*does not name this page/);
});

test('C2 fails when the canonical drops the trailing slash', () => {
  const r = run({
    '/api/thing/': page('/api/thing/', { canonical: `${PROD}/docs/api/thing` }),
  }, { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /C2/);
});

test('C3 fails when og:url disagrees with the canonical', () => {
  const r = run({
    '/api/thing/': page('/api/thing/', { ogUrl: `${PROD}/docs/api/elsewhere/` }),
  }, { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /C3.*og:url/);
});

test('C3 fails when og:description disagrees with the description', () => {
  const r = run({
    '/api/thing/': page('/api/thing/', { ogDescription: 'Something else entirely' }),
  }, { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /C3.*og:description/);
});

test('D0 fails when the canonical host is not an environment we know', () => {
  const r = run({
    '/api/thing/': page('/api/thing/', { host: 'https://example.invalid' }),
  }, { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /D0.*one known environment/);
});

test('D1 fails when a staging page is missing noindex', () => {
  const r = run({
    '/api/a/': page('/api/a/', { host: STAGING, robots: 'noindex, nofollow' }),
    '/api/b/': page('/api/b/', { host: STAGING }),
  });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /D1.*without noindex/);
});

test('D2 fails when a staging build publishes a sitemap', () => {
  const r = run({
    '/api/a/': page('/api/a/', { host: STAGING, robots: 'noindex, nofollow' }),
  }, { sitemap: ['/api/a/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /D2.*must not/);
});

test('D2 fails when a noindex page is listed in the sitemap', () => {
  // The absence assertion. Advertising a page while telling crawlers to ignore
  // it is the site contradicting itself, and neither half can see the other.
  const r = run({
    '/api/thing/': page('/api/thing/', { robots: 'noindex, nofollow' }),
  }, { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /D2.*noindex pages listed in the sitemap/);
});

test('D2 fails when an indexable page is absent from the sitemap', () => {
  const r = run({ '/api/thing/': page('/api/thing/') }, { sitemap: [] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /D2.*absent from the sitemap/);
});

test('E1 fails on two h1 elements', () => {
  const r = run({ '/api/thing/': page('/api/thing/', { extraH1: true }) }, { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /E1.*exactly one <h1>/);
});

test('F1 fails when JSON-LD names a different URL than the canonical', () => {
  const r = run({
    '/api/thing/': page('/api/thing/', {
      jsonLd: JSON.stringify({ '@type': 'TechArticle', url: `${PROD}/docs/api/thing` }),
    }),
  }, { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /F1 {2}structured data disagrees/);
  assert.match(r.out, /JSON-LD url/);
});

test('F1 fails when JSON-LD does not parse', () => {
  const r = run({
    '/api/thing/': page('/api/thing/', { jsonLd: '{not json' }),
  }, { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /F1 {2}structured data disagrees/);
  assert.match(r.out, /JSON-LD does not parse/);
});

/** An h3 with no h2 above it, which is rule D3. */
const SKIPPED_HEADING = '<h3>Straight to level three</h3>';

test('D3 fails when a page skips a heading level', () => {
  const r = run({
    '/api/thing/': page('/api/thing/', { body: SKIPPED_HEADING }),
  }, { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /D3 {2}heading level skipped/);
  assert.match(r.out, /\/api\/thing\/ \(h1 -> h3\)/);
});

// --- L1 and L2, the 404's own head ----------------------------------------
//
// Both are about a page that only ever means "not found". L1: it names no URL
// of its own -- Docusaurus emits four tags that do, all reading
// /docs/404.html/, which 404s. L2: it says noindex, because Cloudflare Pages
// strips the .html and serves the same page at /docs/404 with a 200.

/** The 404 as the build now ships it: no URL of its own, and noindex. */
const CLEAN_404 = () =>
  page('/404.html', { title: 'Page Not Found', canonical: null, ogUrl: null, robots: 'noindex' });

test('a 404 that names no URL of its own and says noindex passes', () => {
  const r = run({ '/api/thing/': page('/api/thing/'), '/404.html': CLEAN_404() },
    { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 0, r.out);
});

test('L1 fails on each of the four tags that name the 404', () => {
  // The gate that keeps plugins/not-found-head.js honest. All four are one
  // defect: gating the canonical alone would leave og:url stating the same
  // dead URL, and C3 -- which compares the two -- runs over routes, which
  // excludes this page.
  const r = run({
    '/api/thing/': page('/api/thing/'),
    '/404.html': page('/404.html', { title: 'Page Not Found', robots: 'noindex', alternate: true }),
  }, { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /L1 {2}the 404 page names a URL of its own, and that URL 404s {2}\[3\]/);
  assert.match(r.out, /404\.html: rel=canonical -> /);
  assert.match(r.out, /404\.html: og:url -> /);
  assert.match(r.out, /404\.html: rel=alternate hreflang=en -> /);
});

test('L2 fails when the 404 does not say noindex', () => {
  const r = run({
    '/api/thing/': page('/api/thing/'),
    '/404.html': page('/404.html', { title: 'Page Not Found', canonical: null, ogUrl: null }),
  }, { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /L2 {2}the 404 page does not say noindex/);
  assert.match(r.out, /robots=absent/);
});

test('L2 accepts the staging build, which says noindex, nofollow', () => {
  const r = run({
    '/api/thing/': page('/api/thing/', { host: STAGING, canonical: null, robots: 'noindex, nofollow' }),
    '/404.html': page('/404.html', {
      title: 'Page Not Found', host: STAGING, canonical: null, ogUrl: null, robots: 'noindex, nofollow',
    }),
  });
  assert.strictEqual(r.code, 0, r.out);
});

// --- The reporting machinery, with every flag true ------------------------
//
// Four self-tests used to stand on whichever rule was still red -- duplicate
// titles, then duplicate descriptions, then skipped headings, then the 404's
// canonical -- and each was rewritten when that rule went green. There is no
// fifth rule to move them to: every flag is true and docs/SEO.md's backlog
// table is empty.
//
// So the condition is CONSTRUCTED. `--ungate <rule>` reports a gated rule
// instead of failing on it, for one run, and these tests feed it a fixture
// that violates that rule. Nothing in CI passes the flag; pr-checks.yml runs
// `node scripts/lint-seo.js` with no arguments.

test('a reported rule does not fail the run, and names its pages', () => {
  const r = run({
    '/api/thing/': page('/api/thing/'),
    '/404.html': page('/404.html', { title: 'Page Not Found', robots: 'noindex' }),
  }, { sitemap: ['/api/thing/'], args: ['--ungate', 'L1'] });
  assert.strictEqual(r.code, 0, r.out);
  assert.match(r.out, /REPORTED, not gated/);
  assert.match(r.out, /L1 {2}the 404 page names a URL of its own/);
  assert.match(r.out, /404\.html: rel=canonical -> /);
});

test('the same fixture fails when the rule is left gated', () => {
  // The other half, and the one that fails if NOT_FOUND_CANONICAL_ENFORCED is
  // flipped back: --ungate must be the only thing standing between the two.
  const r = run({
    '/api/thing/': page('/api/thing/'),
    '/404.html': page('/404.html', { title: 'Page Not Found', robots: 'noindex' }),
  }, { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /FAILED/);
  assert.match(r.out, /L1 {2}the 404 page names a URL of its own/);
});

test('a run that ungated something says so in its header', () => {
  const r = run({ ...OK.pages, '/404.html': CLEAN_404() },
    { sitemap: OK.sitemap, args: ['--ungate', 'L1'] });
  assert.strictEqual(r.code, 0, r.out);
  assert.match(r.out, /ungated {8}L1 — reported for this run, not gated/);
});

test('--ungate refuses a rule that has no flag', () => {
  const r = run(OK.pages, { sitemap: OK.sitemap, args: ['--ungate', 'C1'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /--ungate names no flagged rule: C1/);
});

/** Fifteen pages that each skip a heading level, which is rule D3. */
function fifteenSkips() {
  const pages = {};
  const sitemap = [];
  for (let i = 0; i < 15; i++) {
    const route = `/api/g${i}/`;
    // Distinct titles and distinct descriptions: H1 and H2 are gated too, so a
    // fixture that repeats either fails on those instead of on D3.
    pages[route] = page(route, {
      title: `Page ${i}`,
      description: `Description number ${i}, written long enough to clear the minimum length.`,
      body: SKIPPED_HEADING,
    });
    sitemap.push(route);
  }
  return { pages, sitemap };
}

test('a failing rule lists twelve offenders and counts the rest', () => {
  const { pages, sitemap } = fifteenSkips();
  const r = run(pages, { sitemap });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /D3 {2}heading level skipped {2}\[15\]/);
  assert.match(r.out, /… and 3 more/);
});

test('a reported rule withholds after three, and --report prints them all', () => {
  // The REPORTED printer, which truncates at a different threshold from the
  // failure printer above and points at the flag that shows the rest. It had
  // no test for a while: it needs a reported rule with more than three
  // offenders, and the last rule still reported had exactly one by
  // construction -- the single 404. `--ungate D3` constructs it instead.
  const { pages, sitemap } = fifteenSkips();
  const r = run(pages, { sitemap, args: ['--ungate', 'D3'] });
  assert.strictEqual(r.code, 0, r.out);
  assert.match(r.out, /D3 {2}heading level skipped {2}\[15\]/);
  assert.match(r.out, /… and 12 more \(--report for all\)/);

  const full = run(pages, { sitemap, args: ['--ungate', 'D3', '--report'] });
  assert.strictEqual(full.code, 0, full.out);
  assert.doesNotMatch(full.out, /--report for all/);
  assert.match(full.out, /\/api\/g14\/ \(h1 -> h3\)/);
});

// --- I1, and the suffix that is not the same length on both arms ----------
//
// Docusaurus appends ` | <siteConfig.title>` to every title, and that string
// is 15 characters longer on staging. All three of these use the SAME authored
// title lengths, so they measure only whether the budget moves with the suffix.

const PROD_SUFFIX = 'Market Data';
const STAGING_SUFFIX = 'Market Data Docs (staging)';
const AUTHORED_46 = 'A'.repeat(46); // 46 + ' | Market Data' = exactly 60
const AUTHORED_47 = 'A'.repeat(47); // one over, on either arm

test('I1 fails when an authored title puts the production title over 60', () => {
  const r = run({
    '/api/thing/': page('/api/thing/', { title: AUTHORED_47, suffix: PROD_SUFFIX }),
  }, { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /I1 {2}title over 60 characters/);
});

test('I1 widens its budget on staging, where the suffix is 15 characters longer', () => {
  // The same authored title that fits on production. Against a production-sized
  // budget this measures 75 and fails on characters nobody can delete -- which
  // is what gating LENGTH_ENFORCED did to every non-PROD build until the budget
  // followed the suffix.
  const r = run({
    '/api/thing/': page('/api/thing/', {
      title: AUTHORED_46, suffix: STAGING_SUFFIX, host: STAGING, canonical: null, robots: 'noindex, nofollow',
    }),
  });
  assert.strictEqual(r.code, 0, r.out);
});

test('I1 still fails on staging when the AUTHORED title is too long', () => {
  // The widening must be exactly the suffix difference and no more, or staging
  // stops gating I1 rather than gating it equivalently.
  const r = run({
    '/api/thing/': page('/api/thing/', {
      title: AUTHORED_47, suffix: STAGING_SUFFIX, host: STAGING, robots: 'noindex, nofollow',
    }),
  });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /I1 {2}title over 75 characters/);
});

// --- S1 -------------------------------------------------------------------
// S1 reads this repository's own docs/SEO.md, not the build under test, so
// these run the real checker against the real spec. That is the point: the
// assertion is about whether the shipped document agrees with the shipped
// corpus, which a synthetic fixture cannot tell us.

const SPEC = path.resolve(__dirname, '..', '..', 'docs', 'SEO.md');

const BUILD = path.resolve(__dirname, '..', '..', 'build');
const NOT_FOUND = path.join(BUILD, '404.html');

/**
 * Run the checker over the real build with docs/SEO.md temporarily edited, and
 * optionally build/404.html too.
 *
 * THE 404 IS HOW A BACKLOG IS CONSTRUCTED. S1 compares the table against what
 * a run REPORTED, and with every flag true the real corpus reports nothing —
 * so two of these tests would have nothing to compare and would assert only
 * that a clean run is clean. Putting the canonical back into build/404.html
 * and passing `--ungate L1` gives S1 a real reported count of a real rule,
 * measured off the real artefact, which is the whole point of these running
 * against the shipped build rather than a fixture.
 *
 * Both files are restored in `finally`, and build/ is not tracked anyway.
 */
function withSpec(mutate, { notFound = null, args = [] } = {}) {
  const original = fs.readFileSync(SPEC, 'utf8');
  const originalNotFound = notFound ? fs.readFileSync(NOT_FOUND, 'utf8') : null;
  try {
    fs.writeFileSync(SPEC, mutate(original), 'utf8');
    if (notFound) fs.writeFileSync(NOT_FOUND, notFound(originalNotFound), 'utf8');
    execFileSync('node', [SCRIPT, '--dir', BUILD, ...args], { encoding: 'utf8' });
    return { code: 0, out: '' };
  } catch (e) {
    return { code: e.status, out: `${e.stdout || ''}${e.stderr || ''}` };
  } finally {
    fs.writeFileSync(SPEC, original, 'utf8');
    if (originalNotFound !== null) fs.writeFileSync(NOT_FOUND, originalNotFound, 'utf8');
  }
}

/** Put the canonical the build now strips back into build/404.html. */
const reCanonicalise = (html) =>
  html.replace('</head>', `<link rel="canonical" href="${PROD}/docs/404.html/"></head>`);

/** Insert a row into the backlog table, which now ships with none. */
const addRow = (src, row) => src.replace(
  /^(\|\s*Rule\s*\|\s*Backlog\s*\|.*\n\|[-\s|]+\|\n)/m, `$1${row}\n`);

/** The reported-backlog tests need a build with a 404 in it to re-break. */
const REPORTABLE = { notFound: reCanonicalise, args: ['--ungate', 'L1'] };

const hasBuild = fs.existsSync(path.resolve(__dirname, '..', '..', 'build', 'sitemap.xml'))
  || fs.existsSync(path.resolve(__dirname, '..', '..', 'build', 'index.html'));

test('S1 accepts the shipped table, which has a header and no rows', { skip: !hasBuild && 'no build/ to read' }, () => {
  // Every flag is true and the backlog is empty, so the table is a header and
  // a separator. That is the correct end state and S1 has to read it as zero
  // declared rows -- NOT as a missing table, which fails closed, and not as
  // something to delete, which would fail closed on the next run.
  const r = withSpec((src) => src);
  assert.strictEqual(r.code, 0, r.out);
});

test('S1 fails when the spec understates a backlog', { skip: !hasBuild && 'no build/ to read' }, () => {
  // Someone fixes ten heading orders and does not touch the document. This is
  // the rot that happened in the sibling repo: "101 of 101" against a real 127.
  // Padding-tolerant, because the repo's pre-commit hook re-aligns markdown
  // tables. A spacing-exact pattern silently stops mutating and the test then
  // asserts nothing at all.
  const r = withSpec((src) => addRow(src, '| L1 | 23 | the 404 | `X` |'), REPORTABLE);
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /S1 {2}docs\/SEO\.md disagrees/);
  assert.match(r.out, /L1: docs\/SEO\.md declares 23, this run measured 1/);
});

test('S1 fails when the spec claims a backlog for a rule that is clean', { skip: !hasBuild && 'no build/ to read' }, () => {
  const r = withSpec((src) => addRow(src, '| Z9 | 4 | nothing | `X` |'));
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /Z9: docs\/SEO\.md declares 4, this run reports the rule as clean/);
});

test('S1 fails when a measured rule has no row in the spec', { skip: !hasBuild && 'no build/ to read' }, () => {
  // The empty table against a run that measured something: the direction that
  // catches a backlog appearing, rather than one being paid down.
  const r = withSpec((src) => src, REPORTABLE);
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /L1: measured 1, and docs\/SEO\.md's table has no row for it/);
});

test('S1 fails closed when the backlog table is deleted', { skip: !hasBuild && 'no build/ to read' }, () => {
  // The failure mode that matters most: a parser that finds no rows and
  // compares them against no expectations passes forever while gating nothing.
  const r = withSpec((src) => src.replace(/^\|\s*(Rule|-+|[A-Z]\d)\s*\|.*$\n?/gm, ''), REPORTABLE);
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /S1 {2}docs\/SEO\.md has no backlog table/);
  // and it must say the table is missing, not that a rule needs a row
  assert.doesNotMatch(r.out, /has no row for it/);
});

test('S1 fails closed when the table header is renamed', { skip: !hasBuild && 'no build/ to read' }, () => {
  const r = withSpec((src) => src.replace(/^\|\s*Rule\s*\|\s*Backlog\s*\|/m, '| Rule | Count |'));
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /has no backlog table/);
});

test('S1 still finds the table after a formatter re-pads it', { skip: !hasBuild && 'no build/ to read' }, () => {
  // This repo's pre-commit hook re-aligns every markdown table, so an exact
  // header match would break on the first commit after a column grew.
  const r = withSpec((src) => src.replace(
    /^\|\s*Rule\s*\|\s*Backlog\s*\|\s*What it is\s*\|\s*Flag\s*\|$/m,
    '|   Rule   |   Backlog   |   What it is   |   Flag   |'));
  assert.strictEqual(r.code, 0, r.out);
});

test('S1 is skipped rather than failed when no spec sits beside the build', () => {
  // Every other test in this file runs against a throwaway build with no
  // docs/ beside it, so this is really an assertion that they are not all
  // silently failing S1.
  const r = run(OK.pages, { sitemap: OK.sitemap });
  assert.strictEqual(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /S1/);
});

test('G1 fails when a built page has no Markdown twin', () => {
  // Two independent walks pinned to one artefact. markdown-twins guarantees
  // this at build time; #188 is the case where files went missing AFTER the
  // build that produced them, and nothing downstream re-checked.
  const r = run(OK.pages, { sitemap: OK.sitemap, twins: false });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /G1 {2}built pages whose Markdown twin is not in the build/);
  assert.match(r.out, /api\/thing\/index\.md missing/);
});

test('L3 fails when the sitemap advertises the 404, in any spelling', () => {
  // True today only because @docusaurus/plugin-sitemap excludes the 404 on its
  // own. Nothing stated it until L3, so it would have dropped silently if that
  // exclusion ever changed -- and L2 exists precisely because Pages serves this
  // page at /docs/404 with a 200, so an entry would be an instruction to crawl
  // a soft 404 rather than a stray line.
  for (const spelling of ['/404', '/404/', '/404.html', '/404.html/']) {
    const r = run(OK.pages, { sitemap: [...OK.sitemap, spelling] });
    assert.strictEqual(r.code, 1, `not caught: ${spelling}`);
    assert.match(r.out, /L3 {2}the sitemap advertises the 404 page/);
  }
});

test('G2 fails when a noindex route is advertised in the llms files', () => {
  // Owner's ruling: telling a crawler "do not index this" and an LLM consumer
  // "here is the page and its Markdown" is the site contradicting itself.
  // website#95 is how it happens -- two lists equal once, then a ruling moves
  // one of them and nothing goes red.
  const r = run({
    '/api/thing/': page('/api/thing/'),
    '/api/secret/': page('/api/secret/', {
      robots: 'noindex, nofollow',
      canonical: null,
      title: 'Secret',
      description: 'A second description, distinct from its sibling so H1 and H2 stay out of the way.',
    }),
  }, {
    sitemap: ['/api/thing/'],
    llms: '- [Thing](https://x/docs/api/thing/index.md): a\n'
        + '- [Secret](https://x/docs/api/secret/index.md): b\n',
  });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /G2 {2}noindex routes advertised in the llms files/);
  assert.match(r.out, /\/api\/secret\/ appears in llms\.txt/);
});

test('G2 passes when the noindex route is withheld', () => {
  const r = run({
    '/api/thing/': page('/api/thing/'),
    '/api/secret/': page('/api/secret/', {
      robots: 'noindex, nofollow',
      canonical: null,
      title: 'Secret',
      description: 'A second description, distinct from its sibling so H1 and H2 stay out of the way.',
    }),
  }, {
    sitemap: ['/api/thing/'],
    llms: '- [Thing](https://x/docs/api/thing/index.md): a\n',
  });
  assert.strictEqual(r.code, 0, r.out);
});

test('G2 floor fires on a truncated index', () => {
  // An assertion that passes because it examined nothing: an empty llms.txt
  // satisfies "no noindex route appears in it" perfectly.
  //
  // `--floor` drives the page tripwire and this one from one number, so the
  // fixture is sized to clear the first and trip the second: two pages against
  // a floor of two passes the walk check, and one llms entry does not.
  const r = run({
    '/api/thing/': page('/api/thing/'),
    '/api/other/': page('/api/other/', {
      title: 'Other',
      description: 'A second description, distinct from its sibling so H1 and H2 stay out of the way.',
    }),
  }, {
    sitemap: ['/api/thing/', '/api/other/'],
    llms: '- [Thing](https://x/docs/api/thing/index.md): a\n',
    args: ['--floor', '2'],
  });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /llms\.txt lists only 1 route\(s\), below the floor of 2/);
});

test('the tripwire fires when the walk finds almost nothing', () => {
  // Not a count baseline. Content changes a baseline constantly and it rots;
  // this asks only whether the walk found anything, which the mechanism owns.
  const r = run(OK.pages, { sitemap: OK.sitemap, args: ['--floor', '999'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /below the floor of 999/);
  assert.match(r.out, /tripwire for a walk that stopped matching/);
});

test('a missing build directory is an error, not a pass', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-'));
  fs.rmSync(dir, { recursive: true, force: true });
  let code = 0;
  let out = '';
  try {
    execFileSync('node', [SCRIPT, '--dir', dir], { encoding: 'utf8' });
  } catch (e) {
    code = e.status;
    out = `${e.stdout || ''}${e.stderr || ''}`;
  }
  assert.strictEqual(code, 1);
  assert.match(out, /No build at/);
});

test('an empty build directory is an error, not a pass', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-'));
  let code = 0;
  let out = '';
  try {
    execFileSync('node', [SCRIPT, '--dir', dir], { encoding: 'utf8' });
  } catch (e) {
    code = e.status;
    out = `${e.stdout || ''}${e.stderr || ''}`;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  assert.strictEqual(code, 1);
  assert.match(out, /No HTML found/);
});
