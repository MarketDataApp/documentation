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
  if (o.title !== null) parts.push(`<title>${o.title ?? 'A Page'} | Market Data</title>`);
  if (o.extraTitle) parts.push(`<title>Second</title>`);
  if (o.description !== null) {
    parts.push(`<meta name="description" content="${o.description ?? 'A description long enough to be a real one for the purposes of this fixture.'}">`);
  }
  if (o.canonical !== null) parts.push(`<link rel="canonical" href="${o.canonical ?? url}">`);
  if (o.extraCanonical) parts.push(`<link rel="canonical" href="${url}?x">`);
  parts.push(`<meta property="og:url" content="${o.ogUrl ?? o.canonical ?? url}">`);
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
    `<link href=${PROD}/docs/api/thing/ rel=canonical>` +
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
    '/api/tags/': page('/api/tags/', { description: null }),
    '/search/': page('/search/', { description: null }),
  }, { sitemap: ['/api/thing/', '/api/tags/', '/search/'] });
  assert.strictEqual(r.code, 0, r.out);
});

test('C1 fails when a page has no canonical', () => {
  const r = run({ '/api/thing/': page('/api/thing/', { canonical: null }) }, { sitemap: ['/api/thing/'] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /C1.*no canonical/);
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

test('reported rules do not fail the run, and name their pages', () => {
  // Two pages sharing a title is rule H1, which is measured and not gated.
  const r = run({
    '/api/a/': page('/api/a/', { title: 'Same' }),
    '/api/b/': page('/api/b/', { title: 'Same' }),
  }, { sitemap: ['/api/a/', '/api/b/'] });
  assert.strictEqual(r.code, 0, r.out);
  assert.match(r.out, /REPORTED, not gated/);
  assert.match(r.out, /H1.*more than one page/);
  assert.match(r.out, /\/api\/a\//);
});

test('--report prints every offender rather than the first few', () => {
  const pages = {};
  const sitemap = [];
  for (let g = 0; g < 4; g++) {
    for (const half of ['a', 'b']) {
      const route = `/api/g${g}${half}/`;
      pages[route] = page(route, { title: `Shared ${g}` });
      sitemap.push(route);
    }
  }
  const brief = run(pages, { sitemap });
  const full = run(pages, { sitemap, args: ['--report'] });
  assert.strictEqual(full.code, 0);
  assert.match(brief.out, /--report for all/);
  assert.doesNotMatch(full.out, /--report for all/);
});

// --- S1 -------------------------------------------------------------------
// S1 reads this repository's own docs/SEO.md, not the build under test, so
// these run the real checker against the real spec. That is the point: the
// assertion is about whether the shipped document agrees with the shipped
// corpus, which a synthetic fixture cannot tell us.

const SPEC = path.resolve(__dirname, '..', '..', 'docs', 'SEO.md');

/** Run the checker over the real build with docs/SEO.md temporarily edited. */
function withSpec(mutate) {
  const original = fs.readFileSync(SPEC, 'utf8');
  const build = path.resolve(__dirname, '..', '..', 'build');
  try {
    fs.writeFileSync(SPEC, mutate(original), 'utf8');
    execFileSync('node', [SCRIPT, '--dir', build], { encoding: 'utf8' });
    return { code: 0, out: '' };
  } catch (e) {
    return { code: e.status, out: `${e.stdout || ''}${e.stderr || ''}` };
  } finally {
    fs.writeFileSync(SPEC, original, 'utf8');
  }
}

const hasBuild = fs.existsSync(path.resolve(__dirname, '..', '..', 'build', 'sitemap.xml'))
  || fs.existsSync(path.resolve(__dirname, '..', '..', 'build', 'index.html'));

test('S1 fails when the spec understates a backlog', { skip: !hasBuild && 'no build/ to read' }, () => {
  // Someone pays ten titles down and does not touch the document. This is the
  // rot that happened in the sibling repo: "101 of 101" against a real 127.
  // Padding-tolerant, because the repo's pre-commit hook re-aligns markdown
  // tables. A spacing-exact pattern silently stops mutating and the test then
  // asserts nothing at all.
  const r = withSpec((src) => src.replace(/^\|\s*H1\s*\|\s*\d+\s*\|/m, '| H1 | 23 |'));
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /S1 {2}docs\/SEO\.md disagrees/);
  assert.match(r.out, /H1: docs\/SEO\.md declares 23/);
});

test('S1 fails when the spec claims a backlog for a rule that is clean', { skip: !hasBuild && 'no build/ to read' }, () => {
  const r = withSpec((src) => src.replace(/^\|\s*L1\s*\|\s*\d+\s*\|/m, '| Z9 | 4 |'));
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /Z9: docs\/SEO\.md declares 4, this run reports the rule as clean/);
});

test('S1 fails when a measured rule has no row in the spec', { skip: !hasBuild && 'no build/ to read' }, () => {
  const r = withSpec((src) => src.replace(/^\|\s*D3\s*\|\s*\d+\s*\|.*$/m, ''));
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /D3: measured \d+, and docs\/SEO\.md's table has no row for it/);
});

test('S1 fails closed when the backlog table is deleted', { skip: !hasBuild && 'no build/ to read' }, () => {
  // The failure mode that matters most: a parser that finds no rows and
  // compares them against no expectations passes forever while gating nothing.
  const r = withSpec((src) => src.replace(/^\|\s*(Rule|-+|[A-Z]\d)\s*\|.*$\n?/gm, ''));
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /S1 {2}docs\/SEO\.md has no backlog table/);
  // and it must say the table is missing, not that eight rules need rows
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
