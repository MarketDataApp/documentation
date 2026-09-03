'use strict';

/**
 * The guard's own tests.
 *
 * The property under test is awkward: it is about the RELATIONSHIP between two
 * mtimes, so every case here sets them explicitly with `utimesSync` rather than
 * writing files and hoping the clock cooperates. A test that sleeps to make one
 * file newer than another is a test that fails on a fast machine.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { checkFreshness, newestSource } = require('../build-freshness');

/** A throwaway repo: one source page and a build, with mtimes we choose. */
function scaffold({ sourceAge, buildAge }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fresh-'));
  fs.mkdirSync(path.join(root, 'api'), { recursive: true });
  fs.mkdirSync(path.join(root, 'build'), { recursive: true });
  const src = path.join(root, 'api', 'page.md');
  const built = path.join(root, 'build', 'index.html');
  fs.writeFileSync(src, '# Page\n');
  fs.writeFileSync(built, '<html></html>');

  const now = Date.now() / 1000;
  fs.utimesSync(src, now - sourceAge, now - sourceAge);
  fs.utimesSync(built, now - buildAge, now - buildAge);
  return { root, src, built };
}

test('a build newer than its sources is fresh', () => {
  const { root } = scaffold({ sourceAge: 60, buildAge: 10 });
  const r = checkFreshness(root, path.join(root, 'build'));
  assert.equal(r.stale, false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a source newer than the build is stale', () => {
  // The real case: somebody edits a page and re-runs the check without
  // rebuilding, and the check would otherwise describe the previous artefact.
  const { root } = scaffold({ sourceAge: 10, buildAge: 60 });
  const r = checkFreshness(root, path.join(root, 'build'));
  assert.equal(r.stale, true);
  assert.equal(r.newest.file, path.join('api', 'page.md'));
  fs.rmSync(root, { recursive: true, force: true });
});

test('an undatable build is not reported as stale', () => {
  // An absent or empty build is the caller's own error, and it can say
  // something more useful than this module can.
  const { root } = scaffold({ sourceAge: 10, buildAge: 60 });
  fs.rmSync(path.join(root, 'build', 'index.html'));
  const r = checkFreshness(root, path.join(root, 'build'));
  assert.equal(r.stale, false);
  assert.equal(r.builtMs, null);
  fs.rmSync(root, { recursive: true, force: true });
});

test('the build is dated by a marker file, not by the directory', () => {
  // A directory's mtime moves when anything is added beside it, which would
  // make an untouched build look freshly built.
  const { root, built } = scaffold({ sourceAge: 10, buildAge: 60 });
  const now = Date.now() / 1000;
  fs.utimesSync(path.join(root, 'build'), now, now);   // dir touched, marker not
  const r = checkFreshness(root, path.join(root, 'build'));
  assert.equal(r.stale, true, 'a touched directory must not pass for a rebuild');
  assert.ok(r.builtMs < now * 1000);
  assert.ok(fs.existsSync(built));
  fs.rmSync(root, { recursive: true, force: true });
});

test('config files count as sources, not only content', () => {
  // docusaurus.config.js is where themeConfig.image and the Prism grammar list
  // live, so a change there alters the build with no content edit at all.
  const { root } = scaffold({ sourceAge: 60, buildAge: 30 });
  const cfg = path.join(root, 'docusaurus.config.js');
  fs.writeFileSync(cfg, 'module.exports = {};\n');
  const now = Date.now() / 1000;
  fs.utimesSync(cfg, now, now);
  const r = checkFreshness(root, path.join(root, 'build'));
  assert.equal(r.stale, true);
  assert.equal(r.newest.file, 'docusaurus.config.js');
  fs.rmSync(root, { recursive: true, force: true });
});

test('node_modules is not treated as a source', () => {
  // It is written by every install and would make the guard fire constantly,
  // which is how a guard gets switched off.
  const { root } = scaffold({ sourceAge: 60, buildAge: 30 });
  const nm = path.join(root, 'src', 'node_modules');
  fs.mkdirSync(nm, { recursive: true });
  const junk = path.join(nm, 'x.js');
  fs.writeFileSync(junk, '');
  const now = Date.now() / 1000;
  fs.utimesSync(junk, now, now);
  const r = checkFreshness(root, path.join(root, 'build'));
  assert.equal(r.stale, false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('newestSource returns null when there are no sources at all', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fresh-'));
  assert.equal(newestSource(root), null);
  fs.rmSync(root, { recursive: true, force: true });
});
