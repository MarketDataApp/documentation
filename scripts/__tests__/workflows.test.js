'use strict';

/**
 * Every workflow job that INVOKES pnpm also INSTALLS pnpm.
 *
 * ---------------------------------------------------------------------------
 * The defect
 * ---------------------------------------------------------------------------
 *
 * The yarn -> pnpm migration converted each job's commands and added
 * `pnpm/action-setup` wherever it found `cache: yarn`. One job never had a
 * cache line -- `staging-integration-tests` deliberately installs nothing,
 * because its suites are `node --test` against the standard library. Its
 * commands were rewritten to `pnpm run ...` and it got no pnpm.
 *
 * It failed in SEVEN SECONDS on a step called "Wait for staging to finish
 * deploying", which is a name that makes a fast failure look like anything
 * except a missing binary. It reached a pull request before anyone read it.
 *
 * ---------------------------------------------------------------------------
 * Why a test rather than care
 * ---------------------------------------------------------------------------
 *
 * The pairing is invisible at both ends: the step that needs pnpm and the step
 * that provides it are tens of lines apart, in different sections of a file
 * nobody reads top to bottom, and a job that is missing the second one looks
 * completely ordinary. Nothing else here reads the workflows at all.
 *
 * This is also the only check in the repo that can fail BEFORE a workflow runs.
 * Everything else about CI is discovered by pushing.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOWS = path.resolve(__dirname, '../../.github/workflows');

/**
 * A deliberately small YAML reader.
 *
 * The repo has no YAML dependency and this needs two facts per job: does any
 * `run:` mention pnpm, and does any `uses:` name pnpm/action-setup. Indentation
 * is enough to find job boundaries in these files, and a parser would be a
 * dependency added to answer a question that does not need one.
 */
function jobsOf(text) {
  // COMMENTS ARE STRIPPED FIRST. The first version of this matched
  // `cache: pnpm` inside a comment explaining why a job has no cache, and
  // reported that job as misconfigured. A checker that reads prose as config
  // is not reading config.
  const lines = text
    .split('\n')
    .map((l) => (/^\s*#/.test(l) ? '' : l));
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (start === -1) return [];

  const jobs = [];
  let current = null;
  for (const line of lines.slice(start + 1)) {
    const header = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (header) {
      if (current) jobs.push(current);
      current = { name: header[1], body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) jobs.push(current);
  return jobs.map((j) => ({ name: j.name, body: j.body.join('\n') }));
}

test('every job that runs pnpm also sets pnpm up', () => {
  const files = fs.readdirSync(WORKFLOWS).filter((f) => f.endsWith('.yml'));
  assert.ok(files.length >= 4, `only ${files.length} workflow(s) found; the walk is not matching`);

  const gaps = [];
  let checked = 0;

  for (const file of files) {
    const text = fs.readFileSync(path.join(WORKFLOWS, file), 'utf8');
    for (const job of jobsOf(text)) {
      // Only `run:` lines count as invoking it. A comment mentioning pnpm, or
      // `cache: pnpm`, is not a command.
      const invokes = /^\s*(-\s*)?run:.*\bpnpm\b/m.test(job.body) || /^\s*\|?\s*pnpm\s/m.test(job.body);
      if (!invokes) continue;
      checked += 1;
      if (!/uses:\s*pnpm\/action-setup/.test(job.body)) gaps.push(`${file} :: ${job.name}`);
    }
  }

  assert.ok(checked >= 5, `only ${checked} job(s) invoke pnpm; the reader is not finding jobs`);
  assert.deepEqual(
    gaps,
    [],
    `these jobs run pnpm without pnpm/action-setup, so they fail immediately on ` +
      `"pnpm: command not found":\n  ${gaps.join('\n  ')}`
  );
});

test('pnpm/action-setup comes before setup-node where both appear', () => {
  // `cache: pnpm` makes setup-node shell out to `pnpm store path`, so the order
  // is load-bearing rather than stylistic.
  const files = fs.readdirSync(WORKFLOWS).filter((f) => f.endsWith('.yml'));
  const wrong = [];

  for (const file of files) {
    const text = fs.readFileSync(path.join(WORKFLOWS, file), 'utf8');
    for (const job of jobsOf(text)) {
      if (!/cache:\s*pnpm/.test(job.body)) continue;
      const setupPnpm = job.body.indexOf('pnpm/action-setup');
      const setupNode = job.body.indexOf('actions/setup-node');
      if (setupPnpm === -1 || setupPnpm > setupNode) wrong.push(`${file} :: ${job.name}`);
    }
  }

  assert.deepEqual(
    wrong,
    [],
    `these jobs cache pnpm before installing it, so setup-node's "pnpm store path" fails:\n  ${wrong.join('\n  ')}`
  );
});
