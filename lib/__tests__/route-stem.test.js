'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { routeSuffix, stemOf } = require('../route-stem');

// Shared by plugins/markdown-twins.js and plugins/llms-txt.js. They must agree:
// the twins plugin writes a file at a path derived from the stem, and the
// llms plugin reads that same file back. If the two ever computed a stem
// differently the index would silently lose entries.

test('routeSuffix strips the baseUrl and any leading slash', () => {
  assert.equal(routeSuffix('/docs/api/stocks/candles/', '/docs/'), 'api/stocks/candles/');
  assert.equal(routeSuffix('/docs/', '/docs/'), '');
});

test('routeSuffix treats regex characters in baseUrl literally', () => {
  assert.equal(routeSuffix('/a.b/page/', '/a.b/'), 'page/');
});

test('stemOf drops the trailing slash', () => {
  assert.equal(stemOf('/docs/api/stocks/candles/', '/docs/'), 'api/stocks/candles');
});

test('stemOf returns null for the docs root, which has no source of its own', () => {
  assert.equal(stemOf('/docs/', '/docs/'), null);
});

test('stemOf keeps a file route intact', () => {
  assert.equal(stemOf('/docs/404.html', '/docs/'), '404.html');
});
