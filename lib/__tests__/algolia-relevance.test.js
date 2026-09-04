'use strict';

/**
 * Self-tests for lib/algolia-relevance.js.
 *
 * `judge()` is the whole of this rule's decision-making, and the two gated
 * halves are the ones worth proving. A relevance check that only reports
 * failures is a list; what makes it an instrument is that it fails when a
 * passing query stops passing (C1) and when a known gap stops failing (C2).
 *
 * Both are tested against the real table rather than a fixture, so a row
 * deleted from RELEVANCE cannot quietly take its coverage with it.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { RELEVANCE, routeOf, judge } = require('../algolia-relevance');

const ORIGIN = 'https://www.marketdata.app/docs';

/** The measurement where every row lands exactly where the table wants. */
function allCorrect() {
  return Object.fromEntries(RELEVANCE.map((r) => [r.q, `${ORIGIN}${r.want}/`]));
}

// ---------------------------------------------------------------------------
// routeOf
// ---------------------------------------------------------------------------

test('routeOf reconciles the spellings the two sides use', () => {
  // The index stores an absolute URL with a trailing slash; the table writes a
  // bare route. Comparing raw strings reports every row as failing.
  assert.equal(routeOf(`${ORIGIN}/api/options/chain/`), '/api/options/chain');
  assert.equal(routeOf(`${ORIGIN}/api/options/chain`), '/api/options/chain');
  assert.equal(routeOf(`${ORIGIN}/api/options/chain/#parameters`), '/api/options/chain');
  assert.equal(routeOf(null), '');
});

// ---------------------------------------------------------------------------
// The table itself
// ---------------------------------------------------------------------------

test('every row names a query and a wanted route', () => {
  for (const r of RELEVANCE) {
    assert.ok(r.q && typeof r.q === 'string', JSON.stringify(r));
    assert.ok(r.want && r.want.startsWith('/'), JSON.stringify(r));
  }
});

test('the table keeps a regression surface of passing queries', () => {
  // If every row were a known gap there would be nothing left to protect a
  // ranking change with, and C1 could never fire. The first pageRank attempt
  // scored 8/20 both before and after while silently swapping which eight.
  const passing = RELEVANCE.filter((r) => !r.known);
  assert.ok(passing.length >= 5, `only ${passing.length} rows are expected to pass`);
});

test('every known gap states a reason', () => {
  for (const r of RELEVANCE.filter((x) => x.known)) {
    assert.ok(r.known.length > 10, `${r.q} has no real reason`);
  }
});

// ---------------------------------------------------------------------------
// judge -- the three verdicts
// ---------------------------------------------------------------------------

test('a perfect measurement reports every known gap as fixed and nothing else', () => {
  const { regressions, gaps, fixed } = judge(allCorrect());
  assert.deepEqual(regressions, []);
  assert.deepEqual(gaps, []);
  assert.equal(fixed.length, RELEVANCE.filter((r) => r.known).length);
});

test('C1 fires when a query that should pass returns the wrong page', () => {
  const passing = RELEVANCE.find((r) => !r.known);
  const results = allCorrect();
  results[passing.q] = `${ORIGIN}/sdk/py/somewhere/`;
  const { regressions } = judge(results);
  assert.equal(regressions.length, 1);
  assert.match(regressions[0], new RegExp(`^${passing.q} -> /sdk/py/somewhere`));
});

test('C1 fires when a query that should pass returns nothing at all', () => {
  const passing = RELEVANCE.find((r) => !r.known);
  const results = allCorrect();
  results[passing.q] = null;
  const { regressions } = judge(results);
  assert.equal(regressions.length, 1);
  assert.match(regressions[0], /\(nothing\)/);
});

test('C2 fires when a known gap starts passing, and names the line to delete', () => {
  // The inverse rule. Without it the gap list becomes a graveyard of things
  // fixed long ago that nobody removed, and stops describing the index.
  const gap = RELEVANCE.find((r) => r.known);
  const results = {};
  for (const r of RELEVANCE) results[r.q] = r.known ? `${ORIGIN}/somewhere/else/` : `${ORIGIN}${r.want}/`;
  results[gap.q] = `${ORIGIN}${gap.want}/`;
  const { fixed, gaps, regressions } = judge(results);
  assert.deepEqual(regressions, []);
  assert.equal(fixed.length, 1);
  assert.match(fixed[0], /now passes; delete its `known`/);
  assert.equal(gaps.length, RELEVANCE.filter((r) => r.known).length - 1);
});

test('a known gap that is still failing is a gap, not a regression', () => {
  const results = {};
  for (const r of RELEVANCE) results[r.q] = r.known ? `${ORIGIN}/somewhere/else/` : `${ORIGIN}${r.want}/`;
  const { regressions, gaps, fixed } = judge(results);
  assert.deepEqual(regressions, []);
  assert.deepEqual(fixed, []);
  assert.equal(gaps.length, RELEVANCE.filter((r) => r.known).length);
});

test('a trailing-slash difference alone is never a failure', () => {
  const results = Object.fromEntries(RELEVANCE.map((r) => [r.q, `${ORIGIN}${r.want}`]));
  const { regressions } = judge(results);
  assert.deepEqual(regressions, []);
});
