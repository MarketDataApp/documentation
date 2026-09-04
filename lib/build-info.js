'use strict';

/**
 * Which commit is deployed. One request, one exact answer.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 *
 * The orchestrator merges `MarketDataApp/website` and this repository into ONE
 * Cloudflare Pages deployment, so "what is live?" is two questions and neither
 * source could answer either. The only way to tell whether a change had
 * reached production was to poll a URL and infer from its content -- which
 * works when you know what changed and fails silently when you do not.
 *
 * The failure this makes visible belongs to the other half and is the argument
 * for both: on 2026-08-28 eight verified-correct pages sat in R2 for hours
 * because a dispatch payload was malformed, with every local check green
 * throughout. Nothing inside either source can see that; a sentinel can.
 *
 * The format is agreed with `MarketData-App/website` (2026-09-04) so the two
 * halves answer identically. Each source serves its own file under its own
 * prefix, so nothing collides in the merge and neither repo needs to know
 * about the other:
 *
 *     https://www.marketdata.app/build-info.json        website
 *     https://www.marketdata.app/docs/build-info.json   here
 *
 * ---------------------------------------------------------------------------
 * THE SHA IS FULL LENGTH, AND THAT IS PART OF THE AGREEMENT
 * ---------------------------------------------------------------------------
 *
 * An abbreviated sha is ambiguous across two repositories and cannot be handed
 * straight back to `git`. Forty characters, always.
 *
 * ---------------------------------------------------------------------------
 * A DIRTY TREE MUST NOT PUBLISH A CLEAN SHA
 * ---------------------------------------------------------------------------
 *
 * `git rev-parse HEAD` answers happily with uncommitted changes in the tree,
 * so a local build would publish a commit whose content is not what was built.
 * That is this file's own failure mode -- authoritative and wrong -- and it
 * bites exactly when somebody is debugging a deploy and trusts the answer.
 *
 * CI is clean by construction, so `dirty` is absent from every deployed
 * sentinel. It appears only for a hand-run build, and only when true, which
 * keeps the deployed document exactly the five agreed fields.
 */

const { execFileSync } = require('node:child_process');

/** Run a git command, or return null. Never throws: no git is not a build error. */
function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/**
 * Where the commit comes from, in order.
 *
 * `GITHUB_SHA` first because it is what the workflow was dispatched WITH, and
 * that is the value the other half's post-deploy assertion compares against.
 * Reading the working tree instead would answer a subtly different question in
 * any CI setup that checks out a merge commit.
 */
function resolveGit({ env = process.env, cwd = process.cwd(), run = git } = {}) {
  const sha = env.GITHUB_SHA || run(['rev-parse', 'HEAD'], cwd);
  const ref = env.GITHUB_REF_NAME || run(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  // Only ask the tree when CI did not tell us; a CI checkout is clean and the
  // status call is pure cost there.
  const dirty = env.GITHUB_SHA ? false : Boolean(run(['status', '--porcelain'], cwd));
  return { sha, ref, dirty };
}

/** `production` only when PROD is exactly "true", matching docusaurus.config.js. */
function environmentOf(env = process.env) {
  return env.PROD === 'true' ? 'production' : 'staging';
}

/**
 * The document, in the agreed shape.
 *
 * `builtAt` lives here and NOWHERE ELSE -- see `buildCommitTag`.
 */
function buildInfo({ sha, ref, dirty, environment, builtAt }) {
  const doc = {
    source: 'documentation',
    commit: sha || 'unknown',
    ref: ref || 'unknown',
    environment,
    builtAt,
  };
  // Present only when true, so a deployed sentinel is exactly the five agreed
  // fields and a diff between the two halves' output has nothing spurious in it.
  if (dirty) doc.dirty = true;
  return doc;
}

/**
 * The per-page tag: the commit, and deliberately nothing else.
 *
 * **No timestamp, and no other per-build-varying value.** Two builds of one
 * tree must differ only in places already known to be random, so that a
 * head-only change can be verified by diffing built HTML directly. A clock in
 * every `<head>` destroys that for both repositories -- it was
 * `MarketData-App/website`'s condition on the shared format and it is worth
 * just as much here, where `lib/build-freshness.js` and several checks read
 * built HTML.
 *
 * It exists because THE PAGE AND THE ENDPOINT CAN LEGITIMATELY DISAGREE. Pages
 * are edge-cached and the sentinel is not, so the document in front of a
 * reader may come from an older build than `/docs/build-info.json` reports.
 * That is two cache states, not a defect -- and it is precisely the reader
 * `src/clientModules/chunkReload.js` exists for, who is mid-session across a
 * deploy.
 */
function buildCommitTag(sha) {
  return sha && /^[0-9a-f]{40}$/.test(sha) ? sha : null;
}

module.exports = { resolveGit, environmentOf, buildInfo, buildCommitTag };
