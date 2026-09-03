'use strict';

/**
 * Self-tests for lib/not-found-head.js and the plugin that drives it.
 *
 * The rule these hold is `lint:seo` L1 and L2, and the two checks are pinned to
 * one artefact deliberately: these prove the transform does what it says on any
 * head, and L1/L2 prove the SHIPPED head came out that way. Neither replaces
 * the other — this file would still pass if the plugin were dropped from
 * `docusaurus.config.js`, and L1 is what would fail.
 *
 * The minified fixture is not decoration. The sibling check in
 * MarketDataApp/website read every built page as having no robots tag, because
 * its minifier writes attributes unquoted and reordered and the matcher
 * required quotes. A quoted-only fixture passes forever.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { promises: fs } = require('node:fs');

const { fixNotFoundHead } = require('../not-found-head');
const notFoundHeadPlugin = require('../../plugins/not-found-head');

const URL404 = 'https://www.marketdata.app/docs/404.html/';

/** The head Docusaurus writes for 404.html, quoting and all. */
function notFoundPage(o = {}) {
  const head = [
    '<meta charset="UTF-8">',
    '<title data-rh="true">Page Not Found | Market Data</title>',
    '<meta data-rh="true" name="twitter:card" content="summary_large_image">',
    `<meta data-rh="true" property="og:url" content="${URL404}">`,
    '<meta data-rh="true" property="og:title" content="Page Not Found | Market Data">',
    o.robots ? `<meta data-rh="true" name="robots" content="${o.robots}">` : '',
    '<link data-rh="true" rel="icon" href="/docs/img/favicon.ico">',
    `<link data-rh="true" rel="canonical" href="${URL404}">`,
    `<link data-rh="true" rel="alternate" href="${URL404}" hreflang="en">`,
    `<link data-rh="true" rel="alternate" href="${URL404}" hreflang="x-default">`,
    '<link rel="alternate" type="application/rss+xml" href="/docs/blog/rss.xml" title="Feed">',
    '<script>var x="</head> is not the end";</script>',
  ].join('');
  return `<!doctype html><html lang="en"><head>${head}</head><body><main><h1>Page Not Found</h1></main></body></html>`;
}

test('the four tags that name this page are removed, and nothing else is', () => {
  const { html, removed } = fixNotFoundHead(notFoundPage());
  assert.equal(removed.length, 4);
  assert.doesNotMatch(html, /rel="canonical"/);
  assert.doesNotMatch(html, /property="og:url"/);
  assert.doesNotMatch(html, /hreflang/);
  assert.doesNotMatch(html, new RegExp(URL404.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  // Everything else in that head is untouched, including the OTHER rel=alternate.
  assert.match(html, /rel="icon"/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /application\/rss\+xml/);
  assert.match(html, /twitter:card/);
  assert.match(html, /<title data-rh="true">Page Not Found/);
});

test('a feed rel=alternate survives; only the hreflang ones name this page', () => {
  const { removed } = fixNotFoundHead(notFoundPage());
  assert.equal(removed.filter((r) => r.includes('rel=alternate')).length, 2);
});

test('noindex is added when the build set none', () => {
  const { html, addedRobots } = fixNotFoundHead(notFoundPage());
  assert.equal(addedRobots, true);
  assert.match(html, /<meta name="robots" content="noindex">/);
});

test('noindex is added after the charset, never in front of it', () => {
  // <meta charset> has to fall in the first 1024 bytes of the document.
  const { html } = fixNotFoundHead(notFoundPage());
  assert.ok(html.indexOf('charset') < html.indexOf('name="robots"'));
});

test('the staging build already says noindex, and it is left alone', () => {
  // `noIndex: true` puts "noindex, nofollow" on every page there. A second
  // robots tag would be two directives on one page, which is how they conflict.
  const { html, addedRobots } = fixNotFoundHead(notFoundPage({ robots: 'noindex, nofollow' }));
  assert.equal(addedRobots, false);
  assert.equal(html.match(/name="robots"/g).length, 1);
  assert.match(html, /content="noindex, nofollow"/);
});

test('the body is returned byte for byte', () => {
  // The whole reason this cuts a byte range rather than re-serialising a DOM.
  const src = notFoundPage();
  const { html } = fixNotFoundHead(src);
  assert.equal(html.slice(html.indexOf('</head>')), src.slice(src.indexOf('</head>')));
});

test('a second pass changes nothing', () => {
  const once = fixNotFoundHead(notFoundPage()).html;
  const twice = fixNotFoundHead(once);
  assert.equal(twice.html, once);
  assert.equal(twice.removed.length, 0);
  assert.equal(twice.addedRobots, false);
});

test('unquoted, reordered, minified attributes are read correctly', () => {
  // Nothing here is quoted and the attribute order is inverted. A matcher
  // requiring `rel="canonical"` reads this as having no canonical, which is
  // indistinguishable from a page that has none.
  const src =
    '<!doctype html><html lang=en><head>' +
    '<meta charset=utf-8>' +
    `<meta content=${URL404} property=og:url>` +
    `<link href=${URL404} rel=canonical>` +
    `<link hreflang=en href=${URL404} rel=alternate>` +
    '<meta content=summary name=twitter:card>' +
    '</head><body><main>x</main></body></html>';
  const { html, removed, addedRobots } = fixNotFoundHead(src);
  assert.equal(removed.length, 3);
  assert.equal(addedRobots, true);
  assert.doesNotMatch(html, /rel=canonical/);
  assert.doesNotMatch(html, /og:url/);
  assert.doesNotMatch(html, /hreflang/);
  assert.match(html, /twitter:card/);
});

test('an unquoted robots tag counts as one, so none is added', () => {
  const src =
    '<!doctype html><html lang=en><head><meta charset=utf-8>' +
    '<meta content=noindex,nofollow name=robots>' +
    `<link href=${URL404} rel=canonical></head><body><main>x</main></body></html>`;
  const { html, addedRobots } = fixNotFoundHead(src);
  assert.equal(addedRobots, false);
  assert.equal(html.match(/name=robots/g).length, 1);
});

test('a > inside an attribute value does not end the tag early', () => {
  const src =
    '<!doctype html><html><head><meta charset=utf-8>' +
    '<meta name="description" content="a > b, and b > c">' +
    `<link rel="canonical" href="${URL404}">` +
    '</head><body><main>x</main></body></html>';
  const { html, removed } = fixNotFoundHead(src);
  assert.equal(removed.length, 1);
  assert.match(html, /content="a &gt; b, and b &gt; c"|content="a > b, and b > c"/);
  assert.doesNotMatch(html, /canonical/);
});

test('a page with no head is an error, not a silent pass-through', () => {
  // Returning the input unchanged is the failure this whole change exists to
  // end: something that quietly does nothing while a check somewhere else is
  // the only thing that notices.
  assert.throws(() => fixNotFoundHead('<html><body>no head</body></html>'), /no <head>/);
});

// --- the plugin --------------------------------------------------------------

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'not-found-head-'));

test('postBuild rewrites 404.html in the build', async () => {
  const outDir = await tmp();
  await fs.writeFile(path.join(outDir, '404.html'), notFoundPage(), 'utf8');
  await notFoundHeadPlugin().postBuild({ outDir });
  const written = await fs.readFile(path.join(outDir, '404.html'), 'utf8');
  assert.doesNotMatch(written, /rel="canonical"/);
  assert.match(written, /name="robots" content="noindex"/);
});

test('no .tmp file survives the write', async () => {
  // markdown-twins reads this same 404.html in its own postBuild, and
  // Docusaurus runs postBuild hooks concurrently. The write goes to a
  // temporary name and renames over the target so a concurrent reader gets a
  // whole file; the temporary must not be left behind for the deploy to ship.
  const outDir = await tmp();
  await fs.writeFile(path.join(outDir, '404.html'), notFoundPage(), 'utf8');
  await notFoundHeadPlugin().postBuild({ outDir });
  assert.deepEqual(await fs.readdir(outDir), ['404.html']);
});

test('a build with no 404.html fails, rather than doing nothing', async () => {
  const outDir = await tmp();
  await assert.rejects(() => notFoundHeadPlugin().postBuild({ outDir }), /no 404\.html in the build/);
});
