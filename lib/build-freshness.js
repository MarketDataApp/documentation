'use strict';

/**
 * Answers one question for the checks that read `build/`: is this artefact
 * still the one the sources describe?
 *
 * ---------------------------------------------------------------------------
 * WHY
 * ---------------------------------------------------------------------------
 *
 * `lint-seo`, `check-highlighting` and `lint-sitemap` all read the BUILD, and
 * that is deliberate — it is the artefact people receive, and it is the only
 * place a rendered `<head>`, a Prism token or a sitemap exists at all. But it
 * gives every one of them a state in which they are confidently describing
 * something else:
 *
 *     $ (edit a page's `description:` down to 21 characters)
 *     $ node scripts/lint-seo.js
 *     Every gated rule passed.          <- about the PREVIOUS build
 *
 *     $ PROD=true yarn build && node scripts/lint-seo.js
 *     I3  description under 70 characters  [1]
 *
 * A green answer about a file that no longer exists is worse than a red one,
 * and nothing in the output said which build it read.
 *
 * The trap is only ever hit by a standalone run — which is exactly what a
 * person does after touching a source and wanting a quick answer. CI builds
 * immediately before every check, so it never sees this.
 *
 * Found in MarketDataApp/website first: `lint:links` reads `dist/_redirects`,
 * so editing `public/_redirects` and re-running it reported the rule count of
 * the previous build and read as a clean no-op. Same shape as that repo's #77,
 * where every browser check pointed at whatever dev server was already running
 * because the staleness fingerprint ignored `SITE_ENV`. A correct check,
 * measuring the wrong artefact, saying nothing about it.
 *
 * ---------------------------------------------------------------------------
 * WHY IT FAILS RATHER THAN WARNS
 * ---------------------------------------------------------------------------
 *
 * The whole value of these checks is the verdict. A warning printed above a
 * verdict about the wrong artefact still ships the verdict, and the verdict is
 * the thing people quote. Refusing to answer is the honest response to "I
 * cannot see what you just changed".
 *
 * The remedy is always the same and always cheap: rebuild.
 */

const fs = require('fs');
const path = require('path');

/**
 * Directories and files whose contents end up in the build.
 *
 * Deliberately broad. A missed input is a silent false PASS of this guard,
 * which puts us back where we started; an over-broad one costs a rebuild
 * somebody was going to need anyway.
 */
const SOURCE_DIRS = ['api', 'sdk', 'sheets', 'account', 'src', 'plugins', 'lib', 'static'];
const SOURCE_FILES = ['docusaurus.config.js', 'sidebars.js', 'redirects.js', 'package.json'];

const SKIP = new Set(['node_modules', '.git', '.docusaurus', '__tests__']);

/** The most recently modified source file, or null if none is readable. */
function newestSource(root) {
  let newest = null;
  const consider = (file) => {
    let st;
    try {
      st = fs.statSync(file);
    } catch {
      return;
    }
    if (!newest || st.mtimeMs > newest.mtimeMs) {
      newest = { file: path.relative(root, file), mtimeMs: st.mtimeMs };
    }
  };
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (SKIP.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else consider(full);
    }
  };
  for (const d of SOURCE_DIRS) walk(path.join(root, d));
  for (const f of SOURCE_FILES) consider(path.join(root, f));
  return newest;
}

/**
 * Compare the build against its sources.
 *
 * Returns `{ stale, newest, builtMs }`. `stale` is false when the build cannot
 * be dated — an absent build is the caller's own error to report, and a more
 * specific message than this one can give.
 */
function checkFreshness(root, buildDir) {
  // index.html is written on every build and is the last thing to move, so it
  // dates the artefact better than the directory's own mtime, which changes
  // when anything is added beside it.
  let builtMs = null;
  for (const marker of ['index.html', 'sitemap.xml', '404.html']) {
    try {
      builtMs = fs.statSync(path.join(buildDir, marker)).mtimeMs;
      break;
    } catch {
      /* try the next marker */
    }
  }
  if (builtMs === null) return { stale: false, newest: null, builtMs: null };

  const newest = newestSource(root);
  if (!newest) return { stale: false, newest: null, builtMs };

  return { stale: newest.mtimeMs > builtMs, newest, builtMs };
}

/**
 * Refuse to report a verdict about a build older than its sources.
 *
 * `check` is the command a reader should run to rebuild, named so the message
 * is actionable from whichever check printed it.
 */
function assertFreshBuild(root, buildDir, rebuildCommand) {
  const { stale, newest, builtMs } = checkFreshness(root, buildDir);
  if (!stale) return;
  const age = Math.round((newest.mtimeMs - builtMs) / 1000);
  console.error(
    `${path.relative(root, buildDir)}/ is older than its sources, so this check would ` +
      `describe the PREVIOUS build.\n\n` +
      `  newest source : ${newest.file}\n` +
      `  it is ${age}s newer than the build\n\n` +
      'A green answer about an artefact that no longer exists is worse than a red\n' +
      'one, so this refuses to report rather than reporting about the wrong thing.\n\n' +
      `  ${rebuildCommand}`
  );
  process.exit(1);
}

module.exports = { assertFreshBuild, checkFreshness, newestSource, SOURCE_DIRS, SOURCE_FILES };
