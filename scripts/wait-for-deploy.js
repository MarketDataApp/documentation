#!/usr/bin/env node
'use strict';

/**
 * Waits until the live site has finished deploying, before a suite probes it.
 *
 * ---------------------------------------------------------------------------
 * The problem this removes
 * ---------------------------------------------------------------------------
 *
 * `pr-checks.yml` and `post-deploy-tests.yml` probe the LIVE site. A merge to
 * `staging` takes that site through a ~5 minute chain -- docs build, R2 sync,
 * orchestrator merge, Pages deploy -- during which a SUBSET of pages 404. A
 * check that runs inside that window fails for reasons unrelated to the change
 * under test, and the failure is indistinguishable from a broken redirect:
 *
 *     destination /account/troubleshooting/linkedin-issues returned 404
 *
 * That is #185. The cost is not the re-run, it is that the only way to tell a
 * race from a regression was to correlate timestamps across two workflows in
 * two repositories -- and nobody does that at 5pm. They hit re-run, it passes,
 * and they file it under flake.
 *
 * WHICH IS EXACTLY HOW A REAL FAILURE HID. On 2026-08-26 this job went red
 * with that same signature and stayed red, and it was not a race: it was #188,
 * 57 genuinely deleted pages on staging. It cleared only when the defect was
 * fixed. A check people have been taught to distrust reports nothing when it
 * is right.
 *
 * ---------------------------------------------------------------------------
 * Why a wait and not a retry
 * ---------------------------------------------------------------------------
 *
 * #185 proposes retrying the suite once after 90s. That works, but it charges
 * the 90s to every GENUINE failure, forever, and it automates the very reflex
 * the issue warns about -- "it passed on the second go, must be flake".
 *
 * Waiting first costs nothing when the site is ready, which is almost always,
 * and costs only as long as the deploy actually takes when it is not.
 *
 * ---------------------------------------------------------------------------
 * Two properties that are easy to get wrong
 * ---------------------------------------------------------------------------
 *
 * IT PROBES CACHE-BUSTED. A readiness probe served from a warm edge copy
 * reports the PREVIOUS deployment as ready. That is not hypothetical here:
 * during #188 two deleted pages answered 200 from the edge for 2.08 days.
 * Cloudflare puts the query string in the cache key, so each attempt carries a
 * fresh one and the answer comes from the origin.
 *
 * IT NEVER FAILS THE BUILD. It is a wait, not an assertion -- the suites are
 * the judges, and they say which URL is wrong. On timeout it proceeds anyway
 * and prints what is still down, so the run reads
 *
 *     waited 300s, 3 of 19 still 404 -- running anyway
 *
 * instead of leaving someone to correlate timestamps by hand. That line is the
 * whole point: it turns the diagnosis #185 describes as expensive into one a
 * reader gets for free.
 *
 * Run with: TEST_ENV=staging pnpm run wait:deploy
 */

const { REDIRECTS } = require('../redirects');

const HOSTS = {
  staging: 'https://www-staging.marketdata.app',
  production: 'https://www.marketdata.app',
};

const PREFIX = '/docs';

/** How long to wait before giving up and running the suite regardless. */
const TIMEOUT_MS = Number(process.env.WAIT_TIMEOUT_MS || 300_000);
const INTERVAL_MS = Number(process.env.WAIT_INTERVAL_MS || 10_000);
const CONCURRENCY = 12;

function hostFor(env) {
  const host = HOSTS[env];
  if (!host) {
    throw new Error(
      `unknown TEST_ENV "${env}". Expected one of: ${Object.keys(HOSTS).join(', ')}`
    );
  }
  return host;
}

/**
 * The URLs whose readiness stands for the site's. The redirect DESTINATIONS,
 * because they are the pages #185's failures actually named, they are spread
 * across every docs section, and importing them from redirects.js means this
 * list cannot drift from what the redirect suite asserts.
 */
function targetsFor(host) {
  return [...new Set(REDIRECTS.map((r) => `${host}${PREFIX}${r.to}/`))];
}

/** Cloudflare keys its cache on the query string, so this forces a miss. */
function bust(url, attempt, index) {
  const u = new URL(url);
  u.searchParams.set('cb', `${Date.now()}-${attempt}-${index}`);
  return u.toString();
}

async function pooled(items, worker) {
  const out = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await worker(items[i], i);
      }
    })
  );
  return out;
}

async function probe(urls, attempt) {
  return pooled(urls, async (url, i) => {
    try {
      const res = await fetch(bust(url, attempt, i), { redirect: 'manual' });
      await res.body?.cancel();
      return { url, ok: res.status === 200, status: res.status };
    } catch (err) {
      return { url, ok: false, status: `error: ${err.message}` };
    }
  });
}


/**
 * THE COMMIT GATE, AND WHY 200s WERE NOT ENOUGH.
 *
 * This waited only for a set of pages to answer 200 cache-busted. That proves
 * the site is UP. It says nothing about WHICH BUILD is up -- and every one of
 * those pages answers 200 from the previous deploy just as happily.
 *
 * So on 2026-09-07 the wait returned "ready" in seconds while staging was
 * still serving a build from two days earlier, and the e2e suite ran against
 * it and failed on a fix that was in the branch but not yet on the host. The
 * error named the right defect on the wrong artefact, which is the most
 * expensive kind of red: it looks exactly like the change not working.
 *
 * `/docs/build-info.json` exists to answer this in one request with an exact
 * answer -- the whole reason it was built -- and this readiness check was not
 * asking it.
 *
 * The commit is only KNOWN in CI, from GITHUB_SHA. Locally there is nothing to
 * compare against, so the gate is skipped and SAYS SO rather than passing
 * silently: a check that cannot tell "the right build" from "no idea" must not
 * report the first.
 */
async function deployedCommit(host, attempt) {
  const url = bust(`${host}${PREFIX}/build-info.json`, attempt, 0);
  try {
    const res = await fetch(url, { redirect: 'manual' });
    if (res.status !== 200) return { error: `HTTP ${res.status}` };
    const doc = await res.json();
    return { commit: doc.commit, builtAt: doc.builtAt };
  } catch (err) {
    return { error: err.message };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The commit this run is testing. Set by CI; absent locally, where there is
 * nothing to compare a deployed sentinel against.
 */
const WANTED_COMMIT = process.env.WAIT_FOR_COMMIT || process.env.GITHUB_SHA || '';

async function main() {
  const env = process.env.TEST_ENV;
  if (!env) {
    console.log('[wait-for-deploy] TEST_ENV is not set; nothing to wait for');
    return;
  }

  const host = hostFor(env);
  const urls = targetsFor(host);

  // A wait over an empty list would return "ready" instantly and mean nothing.
  if (urls.length === 0) {
    console.log('[wait-for-deploy] no target URLs; skipping the wait');
    return;
  }

  const started = Date.now();
  let attempt = 0;
  let down = [];

  while (Date.now() - started < TIMEOUT_MS) {
    attempt++;
    const results = await probe(urls, attempt);
    down = results.filter((r) => !r.ok);

    if (down.length === 0) {
      const secs = Math.round((Date.now() - started) / 1000);

      // Up is not the same as current. See deployedCommit above.
      if (!WANTED_COMMIT) {
        console.log(
          `[wait-for-deploy] ${env} ready: ${urls.length} of ${urls.length} probe URL(s) ` +
            `answered 200 (cache-busted) after ${secs}s.\n` +
            '[wait-for-deploy] NO COMMIT TO CHECK (GITHUB_SHA unset), so this confirms the ' +
            'site is up and NOT that it serves this build.'
        );
        return;
      }

      const sentinel = await deployedCommit(host, attempt);
      if (sentinel.commit === WANTED_COMMIT) {
        console.log(
          `[wait-for-deploy] ${env} ready: ${urls.length} probe URL(s) answered 200 and ` +
            `/build-info.json reports ${WANTED_COMMIT.slice(0, 7)} after ${secs}s`
        );
        return;
      }

      console.log(
        `[wait-for-deploy] ${env} is UP but serving ` +
          `${sentinel.commit ? sentinel.commit.slice(0, 7) : `(${sentinel.error})`}` +
          `, not ${WANTED_COMMIT.slice(0, 7)}; waiting ${INTERVAL_MS / 1000}s`
      );
      await sleep(INTERVAL_MS);
      continue;
    }

    console.log(
      `[wait-for-deploy] ${env} not ready: ${down.length} of ${urls.length} ` +
        `not answering 200; waiting ${INTERVAL_MS / 1000}s`
    );
    await sleep(INTERVAL_MS);
  }

  const secs = Math.round((Date.now() - started) / 1000);
  const detail = down.map((d) => `    ${d.status}  ${d.url.split('?')[0]}`).join('\n');
  console.log(
    `::warning::[wait-for-deploy] waited ${secs}s, ${down.length} of ${urls.length} ` +
      'probe URL(s) still not answering 200 -- running the suite anyway'
  );
  console.log(detail);
  console.log(
    '[wait-for-deploy] if the suite now fails on these same URLs, it is more\n' +
      '  likely a real regression than a deploy race: the wait above already\n' +
      '  outlasted a normal deploy.'
  );
}

module.exports = { hostFor, targetsFor, bust, HOSTS, PREFIX };

if (require.main === module) {
  main().catch((err) => {
    // Still not a gate. A broken waiter must not fail a run the suites can judge.
    console.log(`::warning::[wait-for-deploy] ${err.message} -- running the suite anyway`);
  });
}
