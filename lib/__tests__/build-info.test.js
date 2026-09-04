'use strict';

/**
 * Self-tests for lib/build-info.js.
 *
 * The format is agreed with `MarketData-App/website` so the two halves of one
 * Cloudflare Pages deployment answer identically. **Most of what is asserted
 * here is that agreement**, not an internal preference: a field renamed on one
 * side and not the other gives two sentinels that cannot be compared, which is
 * the entire point of having them.
 *
 * `git` is injected rather than shelled out to, so every case below — CI, a
 * clean local tree, a dirty one, no git at all — is reachable from a machine
 * that is only ever in one of those states.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { resolveGit, environmentOf, buildInfo, buildCommitTag } = require('../build-info');

const SHA = '43a17b1f8e51a2ba70c60b4edf49f1f5795543bb';

/** A fake `git` that answers from a table and records what it was asked. */
function fakeGit(answers) {
  const asked = [];
  const run = (args) => {
    asked.push(args.join(' '));
    return Object.prototype.hasOwnProperty.call(answers, args[0]) ? answers[args[0]] : null;
  };
  run.asked = asked;
  return run;
}

// ---------------------------------------------------------------------------
// resolveGit
// ---------------------------------------------------------------------------

test('CI is believed, and its tree is never questioned', () => {
  // GITHUB_SHA is what the workflow was DISPATCHED with, and it is the value
  // the other half's post-deploy assertion compares against. Reading the tree
  // instead would answer a subtly different question wherever CI checks out a
  // merge commit.
  const run = fakeGit({ 'rev-parse': 'ignored', status: 'M something' });
  const got = resolveGit({ env: { GITHUB_SHA: SHA, GITHUB_REF_NAME: 'main' }, run });
  assert.deepEqual(got, { sha: SHA, ref: 'main', dirty: false });
  assert.deepEqual(run.asked, [], 'CI must not be asked about its working tree');
});

test('a clean local tree reports the commit and no dirty flag', () => {
  const run = fakeGit({ 'rev-parse': SHA, status: '' });
  const got = resolveGit({ env: {}, run });
  assert.equal(got.sha, SHA);
  assert.equal(got.dirty, false);
});

test('a DIRTY local tree is flagged', () => {
  // The failure this exists to stop: `git rev-parse HEAD` answers happily with
  // uncommitted changes, so the build would publish a commit whose content is
  // not what was built -- authoritative and wrong, exactly when somebody
  // debugging a deploy is trusting it.
  const run = fakeGit({ 'rev-parse': SHA, status: ' M lib/build-info.js\n' });
  assert.equal(resolveGit({ env: {}, run }).dirty, true);
});

test('no git at all is not a build error', () => {
  const run = fakeGit({});
  const got = resolveGit({ env: {}, run });
  assert.equal(got.sha, null);
  assert.equal(got.ref, null);
});

// ---------------------------------------------------------------------------
// environmentOf -- must match docusaurus.config.js exactly
// ---------------------------------------------------------------------------

test('only PROD=true is production', () => {
  assert.equal(environmentOf({ PROD: 'true' }), 'production');
  for (const v of ['false', '1', 'TRUE', '', undefined]) {
    assert.equal(environmentOf({ PROD: v }), 'staging', `PROD=${v}`);
  }
});

// ---------------------------------------------------------------------------
// buildInfo -- the agreed document
// ---------------------------------------------------------------------------

const base = { sha: SHA, ref: 'main', dirty: false, environment: 'production', builtAt: '2026-09-04T16:00:00Z' };

test('a deployed sentinel is exactly the five agreed fields', () => {
  const doc = buildInfo(base);
  assert.deepEqual(Object.keys(doc).sort(), ['builtAt', 'commit', 'environment', 'ref', 'source'].sort());
  assert.equal(doc.source, 'documentation');
  assert.equal(doc.commit, SHA);
});

test('the sha is full length, which is half the agreement', () => {
  // An abbreviation is ambiguous across two repositories and cannot be handed
  // straight back to git.
  assert.equal(buildInfo(base).commit.length, 40);
});

test('dirty appears only when true, so a deployed document is unchanged by it', () => {
  assert.equal('dirty' in buildInfo(base), false);
  assert.equal(buildInfo({ ...base, dirty: true }).dirty, true);
});

test('a missing commit says so rather than omitting the field', () => {
  // A consumer comparing commits must see a value it can fail on, not an
  // absent key it might read as "no opinion".
  const doc = buildInfo({ ...base, sha: null, ref: null });
  assert.equal(doc.commit, 'unknown');
  assert.equal(doc.ref, 'unknown');
});

// ---------------------------------------------------------------------------
// buildCommitTag -- the per-page half
// ---------------------------------------------------------------------------

test('the tag carries the commit and nothing else', () => {
  // No timestamp, and no other per-build-varying value: two builds of one tree
  // must differ only where they are already known to, or a head-only change
  // cannot be verified by diffing built HTML. That was the other repo's
  // condition on the shared format.
  assert.equal(buildCommitTag(SHA), SHA);
});

test('anything that is not a full sha produces no tag at all', () => {
  // Better no provenance than provenance that cannot be fed back to git.
  for (const v of [null, undefined, '', 'unknown', '43a17b1', `${SHA}X`, SHA.toUpperCase()]) {
    assert.equal(buildCommitTag(v), null, String(v));
  }
});
