'use strict';

/**
 * Self-tests for lib/noindex-head.js.
 *
 * These prove the transform does what it says on any head. `lint:seo` M1 and
 * C1 prove the SHIPPED pages came out that way. Neither replaces the other --
 * this file would still pass if the plugin were dropped from
 * docusaurus.config.js, and M1 is what would fail.
 *
 * The `data-rh` fixtures are not decoration. Docusaurus emits every head tag
 * through react-helmet-async, which writes `<meta data-rh="true" name="robots"
 * …>` and `<link data-rh="true" rel="canonical" …>` -- the attribute a naive
 * matcher anchors on sits SECOND. A matcher written against `<meta name=` or
 * `<link rel=` reads every real page as carrying neither tag, which is a
 * silent pass on the exact pages these rules exist for. That defect shipped
 * here for one commit.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { applyHeadRules, ROBOTS } = require('../noindex-head');

const CANONICAL = '<link data-rh="true" rel="canonical" href="https://www.marketdata.app/docs/x/">';
const NOINDEX = '<meta data-rh="true" name="robots" content="noindex, nofollow">';

const page = (head) => `<!doctype html><html><head><meta charset="UTF-8">${head}</head><body><h1>x</h1></body></html>`;

// ---------------------------------------------------------------------------
// Rule 1 -- /internal/ says noindex
// ---------------------------------------------------------------------------

test('an internal page with no robots tag gets one', () => {
  const r = applyHeadRules(page('<title>Internal</title>'), { internal: true });
  assert.equal(r.addedNoindex, true);
  assert.match(r.html, /<meta name="robots" content="noindex, nofollow">/);
});

test('a page outside /internal/ is never given a directive', () => {
  const r = applyHeadRules(page('<title>API</title>'), { internal: false });
  assert.equal(r.addedNoindex, false);
  assert.equal(r.changed, false);
});

test('charset stays first, because it must be in the first 1024 bytes', () => {
  const { html } = applyHeadRules(page('<title>Internal</title>'), { internal: true });
  assert.ok(html.indexOf('<meta charset="UTF-8">') < html.indexOf('name="robots"'));
});

test('an existing robots tag is found past a leading data-rh attribute', () => {
  const r = applyHeadRules(page(NOINDEX), { internal: true });
  assert.equal(r.addedNoindex, false);
});

test('an unquoted, reordered robots tag counts as one', () => {
  const r = applyHeadRules(page('<meta content=noindex name=robots>'), { internal: true });
  assert.equal(r.addedNoindex, false);
});

// ---------------------------------------------------------------------------
// Rule 2 -- a noindex page emits no canonical
// ---------------------------------------------------------------------------

test('a noindex page loses its canonical', () => {
  const r = applyHeadRules(page(`${NOINDEX}${CANONICAL}`), { internal: false });
  assert.equal(r.strippedCanonical, 1);
  assert.doesNotMatch(r.html, /rel="canonical"/);
});

test('the canonical is found past a leading data-rh attribute', () => {
  // The whole point. `<link rel="canonical"` never matches a real Docusaurus
  // page, because `data-rh` comes first.
  assert.equal(applyHeadRules(page(`${NOINDEX}${CANONICAL}`), {}).strippedCanonical, 1);
});

test('an INDEXABLE page keeps its canonical', () => {
  const r = applyHeadRules(page(CANONICAL), { internal: false });
  assert.equal(r.strippedCanonical, 0);
  assert.match(r.html, /rel="canonical"/);
});

test('an indexable page with an index directive keeps its canonical', () => {
  const head = `<meta data-rh="true" name="robots" content="index, follow">${CANONICAL}`;
  assert.equal(applyHeadRules(page(head), {}).strippedCanonical, 0);
});

test('an internal page loses the canonical the same pass adds the reason for', () => {
  // The ordering that forced both rules into one module: the page is only
  // noindex because rule 1 just made it so.
  const r = applyHeadRules(page(`<title>Internal</title>${CANONICAL}`), { internal: true });
  assert.equal(r.addedNoindex, true);
  assert.equal(r.strippedCanonical, 1);
  assert.doesNotMatch(r.html, /rel="canonical"/);
});

test('og:url and the JSON-LD are left alone', () => {
  // The website's ruling draws the line here: Open Graph is not a search
  // directive and @id is an identifier, not an indexing preference.
  const head = `${NOINDEX}${CANONICAL}<meta data-rh="true" property="og:url" content="https://www.marketdata.app/docs/x/">`;
  const { html } = applyHeadRules(page(head), {});
  assert.match(html, /property="og:url"/);
  assert.doesNotMatch(html, /rel="canonical"/);
});

test('more than one canonical is removed, not just the first', () => {
  const r = applyHeadRules(page(`${NOINDEX}${CANONICAL}${CANONICAL}`), {});
  assert.equal(r.strippedCanonical, 2);
  assert.doesNotMatch(r.html, /rel="canonical"/);
});

test('a rel=alternate hreflang survives; only the canonical goes', () => {
  const head = `${NOINDEX}${CANONICAL}<link data-rh="true" rel="alternate" hreflang="en" href="https://www.marketdata.app/docs/x/">`;
  const { html } = applyHeadRules(page(head), {});
  assert.match(html, /rel="alternate"/);
  assert.doesNotMatch(html, /rel="canonical"/);
});

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

test('a second pass changes nothing', () => {
  const once = applyHeadRules(page(`<title>x</title>${CANONICAL}`), { internal: true }).html;
  const twice = applyHeadRules(once, { internal: true });
  assert.equal(twice.changed, false);
  assert.equal(twice.html, once);
});

test('the body is returned byte for byte', () => {
  const source = page(`${NOINDEX}${CANONICAL}`);
  const { html } = applyHeadRules(source, {});
  assert.equal(html.slice(html.indexOf('<body')), source.slice(source.indexOf('<body')));
});

test('a > inside an attribute value does not end the tag early', () => {
  const head = `${NOINDEX}<link data-rh="true" rel="canonical" href="https://x/?a=1>2">`;
  const r = applyHeadRules(page(head), {});
  assert.equal(r.strippedCanonical, 1);
  assert.doesNotMatch(r.html, /rel="canonical"/);
});

test('a page with no head is an error, not a silent pass-through', () => {
  assert.throws(() => applyHeadRules('<html><body>no head</body></html>', {}), /no <head>/);
});

test('the directive is exported once, so nothing states it twice', () => {
  assert.equal(ROBOTS, '<meta name="robots" content="noindex, nofollow">');
});
