'use strict';

/**
 * Self-tests for lib/chunk-reload.js.
 *
 * The recogniser and the guard are the whole of this feature's judgement, and
 * the guard is the half that can hurt somebody: get it wrong and a reader
 * refreshes forever with no way out but closing the tab. So it is tested for
 * the states that BLOCK a reload at least as hard as the ones that allow it.
 *
 * `src/clientModules/chunkReload.js` holds only the wiring, and the one thing
 * there that no test can see is the capture-phase `true` on the `error`
 * listener. Resource errors do not bubble, so without it the listener never
 * runs -- and a page with no missing chunks looks identical either way.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  MAX_ATTEMPTS,
  MIN_INTERVAL_MS,
  isChunkLoadFailure,
  isChunkAssetError,
  readAttempts,
  shouldReload,
} = require('../chunk-reload');

// ---------------------------------------------------------------------------
// isChunkLoadFailure
// ---------------------------------------------------------------------------

test('a webpack ChunkLoadError is recognised by name', () => {
  const err = new Error('Loading chunk 172a41b4 failed.');
  err.name = 'ChunkLoadError';
  assert.equal(isChunkLoadFailure(err), true);
});

test('it is recognised by message when the name did not survive', () => {
  // A cross-origin script failure can reach the handler with the name gone.
  // Matching on the name alone leaves a real failure unhandled.
  assert.equal(isChunkLoadFailure(new Error('Loading chunk 51d3168d failed.')), true);
  assert.equal(isChunkLoadFailure('Loading CSS chunk 7 failed.'), true);
});

test('an ordinary rejection is not a chunk failure', () => {
  assert.equal(isChunkLoadFailure(new Error('network request failed')), false);
  assert.equal(isChunkLoadFailure(new TypeError('x is not a function')), false);
  assert.equal(isChunkLoadFailure(undefined), false);
  assert.equal(isChunkLoadFailure(null), false);
});

// ---------------------------------------------------------------------------
// isChunkAssetError
// ---------------------------------------------------------------------------

test('a failed build chunk is ours', () => {
  // The real filename from MarketData-App/website#98.
  const target = { tagName: 'SCRIPT', src: 'https://www.marketdata.app/docs/assets/js/172a41b4.6c982ebc.js' };
  assert.equal(isChunkAssetError(target), true);
});

test('it matches without knowing the baseUrl', () => {
  assert.equal(isChunkAssetError({ tagName: 'SCRIPT', src: 'http://localhost:3000/assets/js/a.b.js' }), true);
});

test('a third-party script is NOT ours', () => {
  // Reloading would not fix it, and an advert blocker refusing a request would
  // otherwise put every reader into the guard.
  assert.equal(isChunkAssetError({ tagName: 'SCRIPT', src: 'https://cdn.example.com/tracker.js' }), false);
  assert.equal(isChunkAssetError({ tagName: 'SCRIPT', src: 'https://www.marketdata.app/cdn-cgi/zaraz/i.js' }), false);
});

test('a failed image or stylesheet is not a chunk', () => {
  assert.equal(isChunkAssetError({ tagName: 'IMG', src: '/docs/assets/js/x.y.js' }), false);
  assert.equal(isChunkAssetError({ tagName: 'LINK', href: '/docs/assets/css/x.css' }), false);
  assert.equal(isChunkAssetError(null), false);
  assert.equal(isChunkAssetError(undefined), false);
  assert.equal(isChunkAssetError({ tagName: 'SCRIPT' }), false);
});

// ---------------------------------------------------------------------------
// readAttempts -- storage is never trusted
// ---------------------------------------------------------------------------

test('an absent or unparseable record counts as no attempts', () => {
  assert.deepEqual(readAttempts(null), { n: 0, at: 0 });
  assert.deepEqual(readAttempts('not json'), { n: 0, at: 0 });
  assert.deepEqual(readAttempts('"a string"'), { n: 0, at: 0 });
  assert.deepEqual(readAttempts('[1,2]').n, 0);
});

test('a wrongly shaped record counts as no attempts, not as an error', () => {
  assert.deepEqual(readAttempts('{"n":"two","at":"soon"}'), { n: 0, at: 0 });
  assert.deepEqual(readAttempts('{"n":-4,"at":1}'), { n: 0, at: 1 });
});

test('a good record is read back', () => {
  assert.deepEqual(readAttempts('{"n":1,"at":1757000000000}'), { n: 1, at: 1757000000000 });
});

// ---------------------------------------------------------------------------
// shouldReload -- the guard
// ---------------------------------------------------------------------------

const NOW = 1_757_000_000_000;

test('a first failure reloads', () => {
  assert.equal(shouldReload({ n: 0, at: 0 }, NOW), true);
});

test('a second failure, long enough after the first, reloads', () => {
  // The reader who is reloaded straight into the next deploy. Not rare when
  // deploys come in a run, and exactly the population this exists for.
  assert.equal(shouldReload({ n: 1, at: NOW - MIN_INTERVAL_MS }, NOW), true);
});

test('the cap stops the third, and the page stays broken and quiet', () => {
  assert.equal(shouldReload({ n: MAX_ATTEMPTS, at: NOW - 10 * MIN_INTERVAL_MS }, NOW), false);
  assert.equal(shouldReload({ n: MAX_ATTEMPTS + 5, at: 0 }, NOW), false);
});

test('a second failure INSIDE the interval does not reload', () => {
  // This is the refresh loop. A reload that re-fails immediately must not
  // reload again: a broken page is bad, a page that refreshes forever is worse,
  // and the reader cannot escape it without closing the tab.
  assert.equal(shouldReload({ n: 1, at: NOW - 1 }, NOW), false);
  assert.equal(shouldReload({ n: 1, at: NOW - (MIN_INTERVAL_MS - 1) }, NOW), false);
});

test('a clock that moved backwards does not unlock a reload', () => {
  // now - at goes negative, which must not read as "long ago".
  assert.equal(shouldReload({ n: 1, at: NOW + 60_000 }, NOW), false);
});

test('the interval is long enough to outlast a page load', () => {
  // A second attempt spent inside the first one's load would be the loop this
  // guard exists to prevent, arriving through the guard itself.
  assert.ok(MIN_INTERVAL_MS >= 10_000);
});
