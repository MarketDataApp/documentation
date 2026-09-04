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

module.exports = function buildInfoPlugin(_context, options = {}) {
  return {
    name: 'build-info',

    // The commit also goes into every page's <head>. It is injected here rather
    // than from docusaurus.config.js so that both halves -- the endpoint and the
    // tag -- read ONE resolver. Two call sites resolving the commit separately
    // is two ways to answer the same question, and they would disagree the day
    // somebody changed one.
    injectHtmlTags() {
      const { sha } = options.resolved;
      const { buildCommitTag } = require('../lib/build-info');
      const commit = buildCommitTag(sha);
      if (!commit) return {};
      return {
        headTags: [{ tagName: 'meta', attributes: { name: 'build-commit', content: commit } }],
      };
    },

    async postBuild({ outDir }) {
      const { sha, ref, dirty } = options.resolved;
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
