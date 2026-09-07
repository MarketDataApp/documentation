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

const {
  resolveGit,
  environmentOf,
  buildInfo,
  buildCommitTag,
  commitTagOf,
  auditProvenance,
} = require('../build-info');

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

// ---------------------------------------------------------------------------
// commitTagOf -- reading a built page the only way that survives the minifier
// ---------------------------------------------------------------------------

test('the tag is read unquoted, single-quoted, quoted and reordered', () => {
  // This is the whole reason the reader parses instead of matching. `future.v4`
  // drops the quotes wherever a value does not need them and writes attributes
  // in whatever order it likes, so a pattern requiring `name="build-commit"`
  // finds NOTHING on a healthy build. Five instruments across the two
  // repositories have reported exactly that false zero -- one of them ten
  // minutes after its author read the warning.
  const spellings = [
    `<meta name="build-commit" content="${SHA}">`,
    `<meta name='build-commit' content='${SHA}'>`,
    `<meta name=build-commit content=${SHA}>`,
    `<meta content=${SHA} name=build-commit>`,
    `<meta NAME=Build-Commit content="${SHA}"/>`,
  ];
  for (const tag of spellings) {
    assert.equal(commitTagOf(`<html><head><title>x</title>${tag}</head><body/></html>`), SHA, tag);
  }
});

test('an absent tag and an empty one are different answers', () => {
  // A page with no provenance and a page claiming none are different defects,
  // and the second is the stranger one: something wrote the tag with nothing
  // in it. Collapsing them to `null` would report the second as the first.
  assert.equal(commitTagOf('<html><head><meta name=robots content=noindex></head></html>'), null);
  assert.equal(commitTagOf(`<html><head><meta name=build-commit content=""></head></html>`), '');
});

test('a tag whose name merely starts with build-commit is not the tag', () => {
  assert.equal(commitTagOf('<html><head><meta name=build-committed content=x></head></html>'), null);
});

// ---------------------------------------------------------------------------
// auditProvenance
// ---------------------------------------------------------------------------

const page = (file, commit) => ({ file, commit });

test('every page naming the expected commit is a clean audit', () => {
  const got = auditProvenance({ expected: SHA, pages: [page('a.html', SHA), page('b/c.html', SHA)] });
  assert.deepEqual(got, { scanned: 2, tagged: 2, untagged: [], disagreeing: [] });
});

test('an untagged page and a disagreeing one are reported apart', () => {
  const other = SHA.replace(/^4/, '5');
  const got = auditProvenance({
    expected: SHA,
    pages: [page('a.html', SHA), page('b.html', null), page('c.html', other), page('d.html', '')],
  });
  assert.deepEqual(got.untagged, ['b.html']);
  assert.deepEqual(got.disagreeing, [`c.html -> ${other}`, 'd.html -> (empty)']);
  assert.equal(got.tagged, 3);
});

test('with no commit resolved, any tag at all is a disagreement', () => {
  // buildCommitTag emits nothing rather than a value that cannot be handed back
  // to git, so a tag appearing anyway means a SECOND writer exists.
  const got = auditProvenance({ expected: null, pages: [page('a.html', null), page('b.html', SHA)] });
  assert.deepEqual(got.untagged, ['a.html']);
  assert.deepEqual(got.disagreeing, [`b.html -> ${SHA}`]);
});

// ---------------------------------------------------------------------------
// The plugin's postBuild assertion
// ---------------------------------------------------------------------------

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const buildInfoPlugin = require('../../plugins/build-info');
const { assertPagesAndSentinelNameOneCommit } = buildInfoPlugin;

/** A build that satisfies everything postBuild asserts, so a test can break one thing. */
async function fakeBuild({ pages = 60, commit = SHA, spelling = 'quoted' } = {}) {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'build-info-'));
  // assertBundleCarriesNoBuildVaryingValue reads exactly one main.<hash>.js.
  await fs.mkdir(path.join(outDir, 'assets', 'js'), { recursive: true });
  await fs.writeFile(path.join(outDir, 'assets', 'js', 'main.abc123.js'), 'console.log(1)\n');

  for (let i = 0; i < pages; i++) {
    const dir = path.join(outDir, `section${i % 4}`);
    await fs.mkdir(dir, { recursive: true });
    const tag =
      commit === null
        ? ''
        : spelling === 'unquoted'
          ? `<meta content=${commit} name=build-commit>`
          : `<meta name="build-commit" content="${commit}">`;
    await fs.writeFile(path.join(dir, `page${i}.html`), `<html><head>${tag}</head><body>x</body></html>`);
  }
  return outDir;
}

const docFor = (sha) => buildInfo({ ...base, sha });

test('postBuild passes when every page names the sentinel commit', async () => {
  const outDir = await fakeBuild();
  const got = await assertPagesAndSentinelNameOneCommit(outDir, { sha: SHA, doc: docFor(SHA) });
  assert.deepEqual(got, { scanned: 60, tagged: 60, expected: SHA });
});

test('postBuild reads the minified spelling as readily as the quoted one', async () => {
  const outDir = await fakeBuild({ spelling: 'unquoted' });
  const got = await assertPagesAndSentinelNameOneCommit(outDir, { sha: SHA, doc: docFor(SHA) });
  assert.equal(got.tagged, 60);
});

test('one page without the tag fails the build', async () => {
  const outDir = await fakeBuild();
  await fs.writeFile(path.join(outDir, 'section0', 'page0.html'), '<html><head></head><body>x</body></html>');
  await assert.rejects(
    () => assertPagesAndSentinelNameOneCommit(outDir, { sha: SHA, doc: docFor(SHA) }),
    /1 of 60 built page\(s\) carry no build-commit tag/
  );
});

test('one page naming a different commit fails the build', async () => {
  // The refactor this exists for: the endpoint given its own resolver. Both
  // halves still answer, so nothing else in either repository would notice.
  const outDir = await fakeBuild();
  const other = SHA.replace(/^4/, '5');
  await fs.writeFile(
    path.join(outDir, 'section0', 'page0.html'),
    `<html><head><meta name=build-commit content=${other}></head></html>`
  );
  await assert.rejects(
    () => assertPagesAndSentinelNameOneCommit(outDir, { sha: SHA, doc: docFor(SHA) }),
    /name a commit other than the sentinel's/
  );
});

test('a walk that finds almost nothing fails rather than passing', async () => {
  // A tripwire on the WALK, not a baseline on the content: a renamed output
  // directory or a truncated build arrives here as a small number, and without
  // this it arrives as a clean sweep over nothing.
  const outDir = await fakeBuild({ pages: 3 });
  await assert.rejects(
    () => assertPagesAndSentinelNameOneCommit(outDir, { sha: SHA, doc: docFor(SHA) }),
    /below the floor of 50/
  );
});

test('a commit that is not a sha fails, because no page can carry it', async () => {
  // The endpoint would publish it and every page would stay silent, since
  // buildCommitTag refuses to emit a value nobody can hand back to git.
  const outDir = await fakeBuild({ commit: null });
  await assert.rejects(
    () => assertPagesAndSentinelNameOneCommit(outDir, { sha: '43a17b1', doc: docFor('43a17b1') }),
    /is not a 40-character sha/
  );
});

test('no commit at all is a local build, and a failure in CI', async () => {
  const outDir = await fakeBuild({ commit: null });
  const args = { sha: null, doc: docFor(null) };

  // A workstation without git: the sentinel says `unknown`, no page claims a
  // commit, and those two agree. That is honest, and it never deploys.
  const got = await assertPagesAndSentinelNameOneCommit(outDir, { ...args, env: {} });
  assert.deepEqual(got, { scanned: 60, tagged: 0, expected: null });

  // In CI it cannot happen: Actions always sets GITHUB_SHA and actions/checkout
  // always leaves a repository behind. A deployed sentinel saying `unknown`
  // answers every "what is live?" with a shrug.
  await assert.rejects(
    () => assertPagesAndSentinelNameOneCommit(outDir, { ...args, env: { CI: 'true' } }),
    /would ship "unknown"/
  );
});

test('a tag with no commit to justify it fails, even locally', async () => {
  const outDir = await fakeBuild({ commit: null });
  await fs.writeFile(
    path.join(outDir, 'section0', 'page0.html'),
    `<html><head><meta name=build-commit content=${SHA}></head></html>`
  );
  await assert.rejects(
    () => assertPagesAndSentinelNameOneCommit(outDir, { sha: null, doc: docFor(null), env: {} }),
    /carry a build-commit tag the sentinel does not publish/
  );
});
