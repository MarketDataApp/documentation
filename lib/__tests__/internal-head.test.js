'use strict';

/**
 * Self-tests for lib/internal-head.js.
 *
 * These prove the transform does what it says on any head. `lint:seo` M1
 * proves the SHIPPED page came out that way. Neither replaces the other —
 * this file would still pass if the plugin were dropped from
 * docusaurus.config.js, and M1 is what would fail.
 *
 * The `data-rh` fixtures are not decoration. Docusaurus emits every head tag
 * through react-helmet-async, which writes `<meta data-rh="true" name="robots"
 * …>` — the attribute the matcher must skip past sits BEFORE `name`. A matcher
 * anchored on `<meta name=` reads every such page as carrying no robots tag and
 * stamps a second one. That is the same defect, in the same place, that
 * `not-found-head.test.js` keeps a minified fixture for.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { addNoindex, ROBOTS } = require('../internal-head');

const page = (head) => `<!doctype html><html><head><meta charset="UTF-8">${head}</head><body><h1>x</h1></body></html>`;

test('a page with no robots tag gets one', () => {
  const { html, added } = addNoindex(page('<title>Internal</title>'));
  assert.equal(added, true);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
});

test('the tag goes inside the head, immediately before the close', () => {
  const { html } = addNoindex(page('<title>Internal</title>'));
  assert.match(html, /<\/title>\s*<meta name="robots"[^>]*><\/head>/);
});

test('charset stays first, because it must be in the first 1024 bytes', () => {
  const { html } = addNoindex(page('<title>Internal</title>'));
  assert.ok(html.indexOf('<meta charset="UTF-8">') < html.indexOf('name="robots"'));
});

test('a page that already says noindex is left byte for byte alone', () => {
  // The staging build sets `noIndex` site-wide, so every page arrives with
  // this already. A second tag would not override the first: react-helmet
  // renders both, which is why lint:seo counts rather than requires.
  const source = page('<meta data-rh="true" name="robots" content="noindex, nofollow">');
  const { html, added } = addNoindex(source);
  assert.equal(added, false);
  assert.equal(html, source);
});

test('an existing robots tag is found past a leading data-rh attribute', () => {
  const source = page('<meta data-rh="true" name="robots" content="index, follow">');
  assert.equal(addNoindex(source).added, false);
});

test('an unquoted, reordered robots tag counts as one', () => {
  const source = page('<meta content=index name=robots>');
  assert.equal(addNoindex(source).added, false);
});

test('a second pass changes nothing', () => {
  const once = addNoindex(page('<title>Internal</title>')).html;
  const twice = addNoindex(once);
  assert.equal(twice.added, false);
  assert.equal(twice.html, once);
});

test('a page with no head is an error, not a silent pass-through', () => {
  // Silently returning the input would ship an indexable page and print a
  // count that looked correct.
  assert.throws(() => addNoindex('<html><body>no head</body></html>'), /no <head>/);
});

test('the directive is exported once, so nothing states it twice', () => {
  assert.equal(ROBOTS, '<meta name="robots" content="noindex, nofollow">');
});
