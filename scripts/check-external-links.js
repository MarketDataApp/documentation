#!/usr/bin/env node
'use strict';

/**
 * Every EXTERNAL link in the built site still answers.
 *
 * ---------------------------------------------------------------------------
 * The gap this fills, and the one it deliberately does not
 * ---------------------------------------------------------------------------
 *
 * Docusaurus checks links it can resolve inside the site, and since 3.10 it
 * checks their anchors too -- both gated by `pnpm run lint:links`. Neither
 * knows anything about a URL pointing off the site. 103 of those ship today,
 * across 44 hosts, and until this file nothing had ever asked whether one of
 * them still resolved.
 *
 * ---------------------------------------------------------------------------
 * THE FRAGMENT IS DELIBERATELY IGNORED
 * ---------------------------------------------------------------------------
 *
 * For an INTERNAL deep link we check the anchor, because we own the page and a
 * fragment that resolves to nothing lands the reader in the wrong place with
 * no error. For an EXTERNAL one we check only that the page answers.
 *
 * We do not own the other site's heading ids, they change without telling us,
 * and a great many pages build their anchors in the browser -- so a fragment
 * that is missing from the served HTML is usually present to a reader and
 * absent to a fetch. Asserting it would produce failures nobody can act on and
 * that are wrong as often as they are right. `https://example.org/guide#step-2`
 * is therefore checked as `https://example.org/guide`.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT A PR CHECK
 * ---------------------------------------------------------------------------
 *
 * It runs on a schedule, for the reason `lint:algolia` does: no pull request
 * can make a third-party site go down, and a check that goes red for reasons
 * the author cannot fix is one people learn to skip. A PR CAN introduce a
 * wrong URL, which this catches on the next run rather than at review time --
 * a deliberate trade against a network check that is flaky in CI.
 *
 * ---------------------------------------------------------------------------
 * BROKEN vs SKIPPED, AND WHY BOTH ARE PRINTED
 * ---------------------------------------------------------------------------
 *
 * Only a definitive "this is gone" fails: 404 and 410. Everything else that is
 * not a success -- a timeout, a 429, a 5xx, a 403 from bot protection, a DNS
 * failure -- is SKIPPED and named, never counted as a pass. That distinction
 * is the whole reliability of the check: a run that could not reach half the
 * internet must not look like a run that found half the internet healthy.
 *
 * A run that collects ZERO links fails outright. A check that cannot tell
 * "nothing was wrong" from "nothing was examined" is not a check, and this one
 * extracts its own corpus, so an extraction that quietly stops matching would
 * otherwise report a clean bill of health forever.
 *
 * Links are read from the BUILT HTML with a real parser rather than a regex,
 * because the build emits unquoted attributes -- `href=/docs/x` -- and a
 * pattern expecting quotes silently matches nothing. See CLAUDE.md.
 *
 * Usage:
 *   pnpm run build && node scripts/check-external-links.js
 *   node scripts/check-external-links.js --dir build --concurrency 8
 */

const fs = require('node:fs');
const path = require('node:path');
const domino = require('@mixmark-io/domino');

const ROOT = path.resolve(__dirname, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const DIR = path.resolve(ROOT, arg('dir', 'build'));
const CONCURRENCY = Number(arg('concurrency', 6));
const TIMEOUT_MS = Number(arg('timeout', 15000));
const ATTEMPTS = 2;

/**
 * A floor, not a content baseline. If the extractor stops matching, the honest
 * answer is a red run, not "0 broken links".
 */
const MINIMUM_LINKS = 40;

/**
 * NEVER FAIL A URL ON A HEAD RESPONSE. Confirm with the method a reader uses.
 *
 * HEAD is an optimisation and a good number of hosts do not implement it
 * faithfully. www.nuget.org answers HEAD with 404 and GET with 200 for a
 * package that plainly exists -- the first run of this check reported
 * https://www.nuget.org/packages/MarketDataApp as gone, which would have sent
 * someone to "fix" the C# SDK's install instructions by removing a correct
 * link.
 *
 * So HEAD is used only to earn a fast PASS. Any non-success is re-fetched with
 * GET and the GET decides. That is one rule instead of a list of statuses to
 * make exceptions for, and the list is what would have been wrong: the first
 * version excepted 405, 501, 403 and 400, and 404 was the one that mattered.
 */

/**
 * Links known to be broken, each with the issue that owns it.
 *
 * A check that is red on the day it lands is a check people learn to ignore,
 * and there is one genuine failure in the corpus today. So it is listed --
 * and the LISTING IS GATED IN BOTH DIRECTIONS, which is the only thing that
 * keeps a list like this honest.
 *
 *   * a listed URL that is still broken is reported, not failed
 *   * a listed URL that has STARTED WORKING FAILS THE RUN, naming the line to
 *     delete
 *
 * That second rule is borrowed from `lib/algolia-relevance.js`'s C2, and it is
 * there for the same reason: without it a known-gaps list becomes a graveyard
 * of things fixed long ago that nobody removed, and stops describing reality.
 *
 * Do not add a URL here to make a run green. Add it when an issue exists, and
 * put the issue number in the comment.
 */
const KNOWN_BROKEN = new Map([
  // #213 -- the funds candles endpoint exists in its path-parameter form
  // (/D/VFINX/2024-01-01/2024-01-31/ answers 401) but not in the query-string
  // form the docs use, which stocks does support. Which form is correct is an
  // API contract question, so the docs are unchanged pending that answer.
  ['https://api.marketdata.app/v1/funds/candles/D/VFINX/?from=2024-01-01&to=2024-01-31', 213],
]);

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (entry.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

/** Every off-site URL in the build, fragment stripped, with the pages naming it. */
function collect(dir) {
  const found = new Map();
  for (const file of walk(dir)) {
    const doc = domino.createDocument(fs.readFileSync(file, 'utf8'));
    for (const a of doc.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href') || '';
      if (!/^https?:\/\//i.test(href)) continue;
      // The fragment is dropped here and nowhere else -- see the header.
      const url = href.split('#')[0];
      if (!found.has(url)) found.set(url, new Set());
      found.get(url).add(path.relative(dir, file));
    }
  }
  return found;
}

async function probe(url) {
  const attempt = async (method) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          // Named honestly. A check that disguises itself is one the other
          // site cannot ask us to stop running.
          'User-Agent':
            'MarketDataDocsLinkCheck/1.0 (+https://www.marketdata.app/docs/; link validation)',
          Accept: 'text/html,application/xhtml+xml,*/*',
        },
      });
      return { status: res.status };
    } finally {
      clearTimeout(timer);
    }
  };

  let last;
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      const head = await attempt('HEAD');
      if (head.status < 400) return { status: head.status, method: 'HEAD' };
      // Not a success: HEAD does not get to condemn a URL. See above.
      const get = await attempt('GET');
      return { status: get.status, method: 'GET', headStatus: head.status };
    } catch (error) {
      last = error.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : error.message;
      if (i + 1 < ATTEMPTS) await new Promise((r) => setTimeout(r, 750));
    }
  }
  return { status: null, reason: last };
}

async function pool(items, worker, limit) {
  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await worker(items[i]);
      }
    })
  );
  return results;
}

(async () => {
  if (!fs.existsSync(DIR)) {
    console.error(`No build at ${path.relative(ROOT, DIR)}/ -- run \`pnpm run build\` first.`);
    process.exit(2);
  }

  const links = collect(DIR);
  if (links.size < MINIMUM_LINKS) {
    console.error(
      `Only ${links.size} external link(s) found under ${path.relative(ROOT, DIR)}/, ` +
        `below the floor of ${MINIMUM_LINKS}.\n\n` +
        'This is a tripwire for an extractor that stopped matching, not a content\n' +
        'baseline. Either the build is incomplete or this check is no longer finding\n' +
        'what it reads. Do not lower the floor to make it pass.'
    );
    process.exit(1);
  }

  const urls = [...links.keys()].sort();
  const checked = await pool(urls, async (url) => ({ url, ...(await probe(url)) }), CONCURRENCY);

  const broken = [];
  const skipped = [];
  const knownStillBroken = [];
  const knownNowFixed = [];
  let ok = 0;
  for (const { url, status, reason } of checked) {
    const known = KNOWN_BROKEN.has(url);
    if (status !== null && status < 400) {
      ok += 1;
      // C2, in this file's terms: a known gap that started passing means the
      // list is stale, and the run fails naming the line to delete.
      if (known) knownNowFixed.push({ url, issue: KNOWN_BROKEN.get(url) });
    } else if (status === 404 || status === 410) {
      (known ? knownStillBroken : broken).push({ url, status, issue: KNOWN_BROKEN.get(url) });
    } else {
      skipped.push({ url, why: status ? `HTTP ${status}` : reason });
    }
  }

  console.log(
    `${urls.length} unique external URL(s) from ${new Set([...links.values()].flatMap((s) => [...s])).size} page(s); ` +
      `${ok} answered, ${broken.length} gone, ${skipped.length} unreachable\n`
  );

  if (skipped.length) {
    // Named, never averaged away. These are not passes.
    console.log('UNREACHABLE -- not a pass, and not a failure either:');
    for (const { url, why } of skipped) console.log(`  ${why.padEnd(24)} ${url}`);
    console.log();
  }

  if (knownStillBroken.length) {
    console.log('KNOWN BROKEN -- reported, not failed:');
    for (const { url, status, issue } of knownStillBroken) {
      console.log(`  HTTP ${status}  ${url}  (#${issue})`);
    }
    console.log();
  }

  if (knownNowFixed.length) {
    console.error('A KNOWN-BROKEN LINK NOW ANSWERS. The list below is stale:');
    for (const { url, issue } of knownNowFixed) {
      console.error(`  ${url}  -- delete its KNOWN_BROKEN entry and close #${issue}`);
    }
    console.error(
      '\nThis fails on purpose. A known-gaps list nobody prunes stops describing\n' +
        'reality and starts hiding regressions behind entries fixed long ago.'
    );
    process.exit(1);
  }

  if (broken.length) {
    console.error('GONE -- these answered 404 or 410:');
    for (const { url, status } of broken) {
      console.error(`  HTTP ${status}  ${url}`);
      for (const page of [...links.get(url)].sort().slice(0, 4)) console.error(`      on ${page}`);
    }
    console.error(`\n${broken.length} external link(s) point at a page that is gone.`);
    process.exit(1);
  }

  console.log('Every external link that could be reached still answers.');
})();
