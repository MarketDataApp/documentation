'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { hostFor, targetsFor, bust, HOSTS, PREFIX } = require('../wait-for-deploy');
const { REDIRECTS } = require('../../redirects');

describe('wait-for-deploy', () => {
  test('resolves both hosts', () => {
    assert.equal(hostFor('staging'), HOSTS.staging);
    assert.equal(hostFor('production'), HOSTS.production);
  });

  test('rejects an unknown environment rather than defaulting to one', () => {
    // Defaulting would wait on the wrong host and report it ready, which is
    // worse than not waiting at all.
    assert.throws(() => hostFor('prod'), /unknown TEST_ENV/);
    assert.throws(() => hostFor(''), /unknown TEST_ENV/);
  });

  test('probes redirect destinations, under /docs, slashed', () => {
    const urls = targetsFor(HOSTS.production);
    assert.ok(urls.length > 0, 'no probe URLs');
    for (const u of urls) {
      assert.ok(u.startsWith(`${HOSTS.production}${PREFIX}/`), `not under ${PREFIX}: ${u}`);
      assert.ok(u.endsWith('/'), `not slashed: ${u}`);
    }
  });

  test('the probe list cannot drift from redirects.js', () => {
    const expected = new Set(REDIRECTS.map((r) => r.to));
    const got = new Set(
      targetsFor(HOSTS.production).map((u) =>
        u.slice(`${HOSTS.production}${PREFIX}`.length).replace(/\/$/, '')
      )
    );
    assert.deepEqual([...got].sort(), [...expected].sort());
  });

  test('de-duplicates destinations shared by several redirects', () => {
    const urls = targetsFor(HOSTS.production);
    assert.equal(urls.length, new Set(urls).size);
  });

  test('every attempt gets a distinct cache-buster', () => {
    // A readiness probe served from a warm edge copy reports the PREVIOUS
    // deployment as ready. Two deleted pages answered 200 from cache for
    // 2.08 days during #188, so this is the property that makes the wait mean
    // anything.
    const url = 'https://www.marketdata.app/docs/api/stocks/';
    const a = bust(url, 1, 0);
    const b = bust(url, 2, 0);
    const c = bust(url, 2, 1);
    assert.notEqual(a, b);
    assert.notEqual(b, c);
    for (const u of [a, b, c]) {
      assert.ok(new URL(u).searchParams.get('cb'), `no cb param: ${u}`);
      assert.equal(new URL(u).pathname, '/docs/api/stocks/');
    }
  });
});
