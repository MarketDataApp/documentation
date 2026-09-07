'use strict';

/**
 * Writes the build sentinel into the build.
 *
 * WHAT it is for and WHY the fields are what they are is in `lib/build-info.js`.
 * This file is the wiring, and it has two decisions of its own.
 *
 * ---------------------------------------------------------------------------
 * WHY postBuild AND NOT A STATIC FILE
 * ---------------------------------------------------------------------------
 *
 * `static/build-info.json` would be copied verbatim, and its whole value is a
 * commit nobody can know before the build runs. Committing a placeholder and
 * rewriting it in CI would mean the file in the repository is always a lie,
 * and a local build would publish whatever the last person committed.
 *
 * ---------------------------------------------------------------------------
 * WHERE IT LANDS
 * ---------------------------------------------------------------------------
 *
 * `build/build-info.json` here. `deploy-docs.yml` then nests the whole build
 * under `build/docs/`, so it is served at `/docs/build-info.json` -- the path
 * agreed with `MarketData-App/website`, whose own sentinel sits at
 * `/build-info.json`. Neither collides in the orchestrator's merge.
 *
 * It is NOT a route, so nothing downstream has to care: `markdown-twins`
 * requires a twin per route and this is a file, `lint:sitemap` reads the
 * sitemap, and `lint:seo` walks `index.html`.
 *
 * The `no-store` header it needs is in `deploy-docs.yml`, beside the other
 * cache rules. **A cached sentinel is worse than no sentinel** -- it answers
 * about a previous deploy while looking authoritative.
 */

const { promises: fs } = require('node:fs');
const path = require('node:path');
const { resolveGit, environmentOf, buildInfo } = require('../lib/build-info');

const FILE = 'build-info.json';


/**
 * The client bundle must carry NO value that varies per build.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A PROPERTY CHECK AND NOT A MEASUREMENT
 * ---------------------------------------------------------------------------
 *
 * This defect has been introduced twice, both times through this plugin, both
 * times invisibly. Docusaurus serialises the site config -- PLUGIN OPTIONS
 * INCLUDED -- into `main.<hash>.js`, so any value handed here as an option
 * ships to every reader and moves the bundle's content hash:
 *
 *   1. `builtAt` was passed as an option. A clock in the bundle rehashed it on
 *      every build, so two builds of one tree differed in all 265 pages.
 *   2. The commit sha was then LEFT as an option deliberately, reasoning that
 *      "a sha is stable for a given tree, so it costs no bundle churn". True
 *      per tree, and beside the point: every deploy is a new commit. A
 *      documentation-only change still rehashed the bundle and rewrote every
 *      page, against a `max-age=31536000, immutable` header.
 *
 * Both cost every visitor a ~635 KB re-download for no content change, and
 * stranded every mid-session reader -- the reader
 * `src/clientModules/chunkReload.js` exists to recover.
 *
 * The obvious guard is to rebuild twice and diff. That is a SAMPLE, and it
 * needs repeating for every future commit. This asserts the PROPERTY instead:
 * the bundle cannot vary with the build if it contains no build-varying value.
 * Checked once, settles every commit afterwards. Framing borrowed from
 * MarketDataApp/www-marketdata-app, which verified the sha fix this way and
 * was right that it is the stronger form.
 *
 * A MISSING BUNDLE FAILS. A check that cannot tell "nothing was wrong" from
 * "nothing was examined" is not a check, and this one reads exactly one file.
 */
async function assertBundleCarriesNoBuildVaryingValue(outDir) {
  const jsDir = path.join(outDir, 'assets', 'js');
  let entries = [];
  try {
    entries = (await fs.readdir(jsDir)).filter((f) => /^main\.[^.]+\.js$/.test(f));
  } catch {
    /* handled below */
  }
  if (entries.length !== 1) {
    throw new Error(
      `[build-info] expected exactly one assets/js/main.<hash>.js, found ${entries.length}.\n` +
        'This check reads that one file, so it cannot pass by reading nothing.\n' +
        'If the bundler stopped emitting that name, teach this check the new one.'
    );
  }

  const bundle = await fs.readFile(path.join(jsDir, entries[0]), 'utf8');

  // A 40-hex run is a git sha. Deliberately not 32: the Algolia SEARCH key in
  // themeConfig is 32 hex, is public, and is stable across builds, so it is
  // not what this is looking for.
  const sha = bundle.match(/\b[0-9a-f]{40}\b/);
  const clock = bundle.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  const found = sha ? `a 40-hex git sha (${sha[0].slice(0, 12)}...)` : clock ? `a timestamp (${clock[0]})` : null;

  if (found) {
    throw new Error(
      `[build-info] ${entries[0]} contains ${found}.\n\n` +
        'A build-varying value has reached the client bundle, which rehashes it\n' +
        'on every build and re-downloads ~635 KB for every visitor with no\n' +
        'content change, against an immutable one-year header.\n\n' +
        'The usual cause is a value passed to a plugin as an OPTION: Docusaurus\n' +
        'serialises the config, options included, into this file. Resolve it\n' +
        'inside the plugin instead -- an option is a value published to every\n' +
        'reader and charged to the bundle hash, and neither is visible at the\n' +
        'call site.'
    );
  }
}

module.exports = function buildInfoPlugin() {
  // ---------------------------------------------------------------------
  // RESOLVED HERE, NOT IN docusaurus.config.js, AND THAT IS THE WHOLE POINT
  // ---------------------------------------------------------------------
  //
  // Docusaurus serialises the config -- PLUGIN OPTIONS INCLUDED -- into
  // `main.js`. Anything handed to this plugin as an option therefore ships to
  // every reader AND moves the bundle's content hash.
  //
  // `builtAt` was removed from the options for that reason. The COMMIT was
  // left behind on the reasoning that "a sha is stable for a given tree, so it
  // costs no bundle churn". That is true per tree and irrelevant in practice:
  // EVERY DEPLOY IS A NEW COMMIT. A documentation-only change rehashed
  // `main.js` and rewrote all 265 pages, against a
  // `max-age=31536000, immutable` header, with no content difference at all.
  // Measured by the orchestrator on a CLAUDE.md-only commit: 269 files
  // differed, and every one of them was identical once the sha was tokenised.
  //
  // Nothing in the browser needs the sha. Both consumers are build-time -- the
  // `<meta name="build-commit">` below and `build-info.json` in postBuild -- so
  // resolving it inside the plugin keeps it out of the serialised config
  // entirely.
  //
  // The "one resolver" property the config comment used to protect is
  // preserved and, if anything, tightened: this is still resolved ONCE, and it
  // now lives with its only two consumers instead of being handed to them.
  const resolved = resolveGit();

  return {
    name: 'build-info',

    // The commit also goes into every page's <head>. It is injected here rather
    // than from docusaurus.config.js so that both halves -- the endpoint and the
    // tag -- read ONE resolver. Two call sites resolving the commit separately
    // is two ways to answer the same question, and they would disagree the day
    // somebody changed one.
    injectHtmlTags() {
      const { sha } = resolved;
      const { buildCommitTag } = require('../lib/build-info');
      const commit = buildCommitTag(sha);
      if (!commit) return {};
      return {
        headTags: [{ tagName: 'meta', attributes: { name: 'build-commit', content: commit } }],
      };
    },

    async postBuild({ outDir }) {
      const { sha, ref, dirty } = resolved;
      const doc = buildInfo({
        sha,
        ref,
        dirty,
        environment: environmentOf(),
        // Stamped HERE, not in docusaurus.config.js. Plugin options are
        // serialised into the client bundle, so a timestamp passed in as an
        // option ships to every reader and changes `main.<hash>.js` on every
        // build. See the note above BUILD_INFO in docusaurus.config.js.
        builtAt: new Date().toISOString(),
      });

      const target = path.join(outDir, FILE);
      const temporary = `${target}.tmp`;
      await fs.writeFile(temporary, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
      await fs.rename(temporary, target);

      await assertBundleCarriesNoBuildVaryingValue(outDir);

      // Every value, every build. A sentinel that prints nothing cannot be told
      // apart from one that wrote `unknown`, and `unknown` is what a build with
      // no git available produces.
      console.log(
        `[build-info] ${FILE}: ${doc.commit} on ${doc.ref} (${doc.environment})` +
          `${doc.dirty ? ' -- DIRTY TREE, this build is not its commit' : ''}`
      );
    },
  };
};
