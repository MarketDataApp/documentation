'use strict';

/**
 * Self-tests for lib/algolia.js.
 *
 * These hold the judgement half of `lint:algolia`. The check itself asks
 * Algolia for the numbers; every decision it makes about them is made here,
 * with no network, so the rules can be proved to FIRE rather than merely to
 * pass on a good day.
 *
 * That distinction is the whole reason this file exists. On 2026-09-04 the
 * index had been stale for 192 days and every green surface in the repository
 * stayed green. A watchdog nobody has watched fail is indistinguishable from
 * one that cannot fail, so the February state is a fixture below and the rule
 * that would have caught it is asserted against it directly.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  isWriteOperation,
  newestWrite,
  ageInDays,
  sitemapUrls,
  normaliseUrl,
  coverage,
  settingsDrift,
} = require('../algolia');

// ---------------------------------------------------------------------------
// isWriteOperation / newestWrite -- the second freshness witness
// ---------------------------------------------------------------------------

test('reads are not writes', () => {
  const reads = [
    { method: 'POST', url: '/1/indexes/*/queries' },
    { method: 'POST', url: '/1/indexes/Market%20Data%20Documentation/query' },
    { method: 'GET', url: '/1/indexes' },
    { method: 'GET', url: '/1/indexes/Market%20Data%20Documentation/settings' },
    { method: 'GET', url: '/1/keys' },
    { method: 'POST', url: '/1/indexes/Market%20Data%20Documentation/browse' },
  ];
  for (const entry of reads) assert.equal(isWriteOperation(entry), false, JSON.stringify(entry));
});

test('writes are writes', () => {
  const writes = [
    { method: 'POST', url: '/1/indexes/Market%20Data%20Documentation/batch' },
    { method: 'POST', url: '/1/indexes/Market%20Data%20Documentation/operation' },
    { method: 'PUT', url: '/1/indexes/Market%20Data%20Documentation/settings' },
    { method: 'DELETE', url: '/1/indexes/Market%20Data%20Documentation' },
    { method: 'POST', url: '/1/indexes/Market%20Data%20Documentation/clear' },
  ];
  for (const entry of writes) assert.equal(isWriteOperation(entry), true, JSON.stringify(entry));
});

test('an unknown POST verb counts as a write, not as a read', () => {
  // Deliberate: an Algolia verb we have never seen must not be able to make a
  // dead index look alive. Erring the other way is the failure mode this whole
  // module exists to end.
  assert.equal(isWriteOperation({ method: 'POST', url: '/1/indexes/x/somethingNew' }), true);
});

test('a log of nothing but reads yields no write -- the February state', () => {
  // The real log on 2026-09-04: 3,029 entries reaching back 101 days, every
  // one a read. `newestWrite` returning null is what rule A4 fails on.
  const log = Array.from({ length: 500 }, (_, i) => ({
    method: 'POST',
    url: '/1/indexes/*/queries',
    timestamp: `2026-08-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
  }));
  assert.equal(newestWrite(log), null);
});

test('newestWrite picks the latest write and ignores later reads', () => {
  const log = [
    { method: 'POST', url: '/1/indexes/*/queries', timestamp: '2026-09-04T10:00:00Z' },
    { method: 'POST', url: '/1/indexes/x/batch', timestamp: '2026-09-01T10:00:00Z' },
    { method: 'POST', url: '/1/indexes/x/batch', timestamp: '2026-09-03T10:00:00Z' },
  ];
  assert.equal(newestWrite(log).timestamp, '2026-09-03T10:00:00Z');
});

// ---------------------------------------------------------------------------
// ageInDays -- rule A2
// ---------------------------------------------------------------------------

test('ageInDays measures the stall that nothing reported', () => {
  const now = new Date('2026-09-04T13:00:00Z');
  assert.equal(ageInDays('2026-02-24T12:40:31Z', now), 192);
});

test('ageInDays returns null for an unreadable timestamp', () => {
  assert.equal(ageInDays('not a date'), null);
  assert.equal(ageInDays(undefined), null);
});

// ---------------------------------------------------------------------------
// URL handling -- rule A5
// ---------------------------------------------------------------------------

test('sitemapUrls reads every loc', () => {
  const xml = `<?xml version="1.0"?><urlset>
    <url><loc>https://www.marketdata.app/docs/api/</loc></url>
    <url><loc> https://www.marketdata.app/docs/sdk/ </loc></url>
  </urlset>`;
  assert.deepEqual(sitemapUrls(xml), [
    'https://www.marketdata.app/docs/api/',
    'https://www.marketdata.app/docs/sdk/',
  ]);
});

test('normaliseUrl reconciles the two spellings the sides actually use', () => {
  // The sitemap writes a trailing slash, DocSearch stored none before the
  // 2026-09-04 reindex and stores one after it. Comparing raw strings reported
  // every route as missing, which reads as a catastrophe and is punctuation.
  assert.equal(
    normaliseUrl('https://www.marketdata.app/docs/api/stocks/candles/'),
    normaliseUrl('https://www.marketdata.app/docs/api/stocks/candles')
  );
  assert.equal(
    normaliseUrl('https://www.marketdata.app/docs/api/stocks/candles/#parameters'),
    'https://www.marketdata.app/docs/api/stocks/candles'
  );
});

test('coverage names what is missing in each direction', () => {
  const result = coverage(
    ['https://x/docs/a/', 'https://x/docs/b/', 'https://x/docs/c/'],
    ['https://x/docs/a', 'https://x/docs/c#anchor'.split('#')[0], 'https://x/docs/internal/seo']
  );
  assert.deepEqual(result.missing, ['https://x/docs/b']);
  assert.deepEqual(result.extra, ['https://x/docs/internal/seo']);
});

// ---------------------------------------------------------------------------
// settingsDrift -- rule A7
// ---------------------------------------------------------------------------

const LIVE_SETTINGS = {
  searchableAttributes: [
    'unordered(hierarchy.lvl1)',
    'unordered(hierarchy.lvl0)',
    'unordered(hierarchy.lvl2)',
    'content',
  ],
  distinct: true,
  attributeForDistinct: 'url',
};

test('the settings this site actually runs show no drift', () => {
  assert.deepEqual(settingsDrift(LIVE_SETTINGS), []);
});

test('drift is reported when lvl0 outranks lvl1 -- the Docusaurus default', () => {
  // This is precisely what the crawler config held on 2026-09-04, one reindex
  // away from overwriting the live tweak in a place no key of ours can rewrite.
  const reverted = {
    ...LIVE_SETTINGS,
    searchableAttributes: [
      'unordered(hierarchy.lvl0)',
      'unordered(hierarchy.lvl1)',
      'content',
    ],
  };
  const drift = settingsDrift(reverted);
  assert.equal(drift.length, 1);
  assert.match(drift[0], /lvl1 ranks below/);
});

test('drift is reported when distinct is lost', () => {
  const drift = settingsDrift({ ...LIVE_SETTINGS, distinct: false });
  assert.equal(drift.length, 1);
  assert.match(drift[0], /distinct is false/);
});

test('drift is reported when the hierarchy attributes disappear entirely', () => {
  const drift = settingsDrift({ ...LIVE_SETTINGS, searchableAttributes: ['content'] });
  assert.match(drift[0], /does not list both/);
});
