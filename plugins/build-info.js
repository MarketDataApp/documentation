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
const {
  SENTINEL_FILE,
  resolveGit,
  environmentOf,
  buildInfo,
  buildCommitTag,
  commitTagOf,
  auditProvenance,
} = require('../lib/build-info');

// Named in lib/build-info.js, because deploy-docs.yml's `no-store` rule names
// the same string and nothing else couples them.
const FILE = SENTINEL_FILE;

// A "the walk found nothing" tripwire, NOT a page count to keep in step with
// the content. The build has 265 pages; a walk that stops matching, a renamed
// output directory or a truncated build all arrive here as a small number, and
// without this they arrive as a clean pass over almost nothing. Set far below
// any plausible content state, so no ordinary edit approaches it. Do not lower
// it to make it pass. Same shape as scripts/check-highlighting.js's floor.
const PAGE_FLOOR = 50;


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

/** Every built .html file, depth first. */
async function builtPages(dir, acc = []) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await builtPages(full, acc);
    else if (entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

/** GitHub Actions sets both. Nothing else here should. */
function inCI(env) {
  return env.CI === 'true' || env.GITHUB_ACTIONS === 'true';
}

/**
 * The pages and the endpoint must name ONE commit, and it must be a real one.
 *
 * ---------------------------------------------------------------------------
 * WHY THE SENTINEL NEEDS A GATE MORE THAN ANYTHING ELSE HERE DOES
 * ---------------------------------------------------------------------------
 *
 * Every other check in this repository guards something that fails VISIBLY. A
 * sentinel fails by ANSWERING -- with `unknown`, or with a commit its own pages
 * disagree with -- and an answer is exactly what the reader came for. Its whole
 * value is that somebody stops guessing what is live and trusts it instead, so
 * its failure mode is a confident wrong answer at the moment somebody decided
 * to stop checking. Nothing about the page looks different.
 *
 * ---------------------------------------------------------------------------
 * WHY IT RUNS HERE AND NOT IN A LINT SCRIPT
 * ---------------------------------------------------------------------------
 *
 * The build that deploys runs `pnpm run build` and nothing else. A check in
 * `scripts/` gates pull requests and is absent from the one build whose output
 * ships -- and the defect it looks for is introduced by editing THIS file, in a
 * commit that need not touch anything a PR check reads. So it runs where it
 * cannot be skipped, beside the bundle property above, for the same reason.
 *
 * MarketDataApp/website asserts the same property from `dist/` as
 * `test:build-sentinel`; that repo builds its own deploy artefact under its own
 * check suite, so a script is enough there. The two halves must agree about
 * this or the comparison between them means nothing, which is the whole reason
 * the format is shared.
 *
 * ---------------------------------------------------------------------------
 * THREE STATES, AND ONLY TWO OF THEM ARE HONEST
 * ---------------------------------------------------------------------------
 *
 *   a real 40-hex sha  -> every page carries it, and the endpoint publishes it
 *   no commit at all   -> no page carries a tag, and the endpoint says
 *                         `unknown`. Permitted on a workstation with no git,
 *                         and never in CI, where GITHUB_SHA is always set.
 *   anything else      -> the endpoint publishes a string the pages cannot
 *                         carry. `buildCommitTag` drops it rather than emit a
 *                         value nobody can hand back to git, so the endpoint
 *                         answers while every page is silent. Always fatal.
 */
async function assertPagesAndSentinelNameOneCommit(outDir, { sha, doc, env = process.env }) {
  const expected = buildCommitTag(sha);

  if (!expected && sha) {
    throw new Error(
      `[build-info] the sentinel would publish commit "${doc.commit}", which is not a 40-character sha.\n\n` +
        'Every built page therefore carries NO build-commit tag: buildCommitTag()\n' +
        'emits nothing rather than a value that cannot be handed back to git. So\n' +
        '/docs/build-info.json would answer, authoritatively, with something no\n' +
        'reader can use, and no page would contradict it.\n\n' +
        'GITHUB_SHA is the usual source. It is 40 hex characters or it is a mistake.'
    );
  }

  if (!expected && inCI(env)) {
    throw new Error(
      '[build-info] no commit could be resolved, so the sentinel would ship "unknown".\n\n' +
        'resolveGit() falls back rather than throwing, because no git is not a build\n' +
        'error on a workstation. In CI it is one: Actions always sets GITHUB_SHA and\n' +
        'actions/checkout always leaves a repository behind. A deployed sentinel\n' +
        'saying "unknown" answers every "what is live?" with a shrug -- which is the\n' +
        'answer this endpoint exists to replace.'
    );
  }

  const files = await builtPages(outDir);
  const pages = await Promise.all(
    files.map(async (file) => ({
      file: path.relative(outDir, file),
      commit: commitTagOf(await fs.readFile(file, 'utf8')),
    }))
  );

  const { scanned, tagged, untagged, disagreeing } = auditProvenance({ expected, pages });

  if (scanned < PAGE_FLOOR) {
    throw new Error(
      `[build-info] only ${scanned} built page(s) under ${outDir}, below the floor of ${PAGE_FLOOR}.\n\n` +
        'This is a tripwire for a walk that stopped matching, not a content\n' +
        'baseline. Either the build is incomplete or this check is no longer\n' +
        'finding what it reads. Do not lower the floor to make it pass.'
    );
  }

  const sample = (list) =>
    list.slice(0, 5).map((p) => `    ${p}`).join('\n') + (list.length > 5 ? `\n    ... and ${list.length - 5} more` : '');

  if (!expected) {
    if (disagreeing.length) {
      throw new Error(
        `[build-info] ${disagreeing.length} of ${scanned} page(s) carry a build-commit tag ` +
          'the sentinel does not publish.\n' +
          sample(disagreeing) +
          '\n\nNo commit was resolved, so this plugin emitted no tag. Something else\n' +
          'wrote one, which means two writers answer one question.'
      );
    }
    return { scanned, tagged, expected };
  }

  if (untagged.length) {
    throw new Error(
      `[build-info] ${untagged.length} of ${scanned} built page(s) carry no build-commit tag.\n` +
        sample(untagged) +
        '\n\ninjectHtmlTags() puts it in every page. A page without it has no\n' +
        'provenance, so a reader looking at it cannot tell which build served it --\n' +
        'and the page and the endpoint are ALLOWED to disagree, because pages are\n' +
        'edge-cached and the sentinel is not. That disagreement is readable only\n' +
        'while every page states its own commit.'
    );
  }

  if (disagreeing.length) {
    throw new Error(
      `[build-info] ${disagreeing.length} of ${scanned} page(s) name a commit other than the ` +
        `sentinel's (${expected}).\n` +
        sample(disagreeing) +
        '\n\nThe tag and the endpoint must come from ONE resolver. Two call sites\n' +
        'answering one question is two ways to be right and one way to disagree,\n' +
        'and the disagreement is invisible: both halves still answer.'
    );
  }

  return { scanned, tagged, expected };
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

      const provenance = await assertPagesAndSentinelNameOneCommit(outDir, { sha, doc });

      await assertBundleCarriesNoBuildVaryingValue(outDir);

      // Every value, every build. A sentinel that prints nothing cannot be told
      // apart from one that wrote `unknown`, and `unknown` is what a build with
      // no git available produces.
      console.log(
        `[build-info] ${FILE}: ${doc.commit} on ${doc.ref} (${doc.environment})` +
          `${doc.dirty ? ' -- DIRTY TREE, this build is not its commit' : ''}` +
          `, and all ${provenance.scanned} built page(s) agree` +
          `${provenance.expected ? '' : ' (no commit resolved, so no page claims one)'}`
      );
    },
  };
};

// Exported for `lib/__tests__/build-info.test.js`, and for nothing else.
//
// Two of the branches above can only be reached with a broken resolver or with
// no git at all, which is a state a test can describe and a machine cannot be
// put into on demand. Docusaurus requires this module and calls the default
// export; a property hung on it is never read, never serialised, and never
// reaches the client bundle -- unlike a plugin OPTION, which is all three.
module.exports.assertPagesAndSentinelNameOneCommit = assertPagesAndSentinelNameOneCommit;
