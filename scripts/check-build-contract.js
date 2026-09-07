#!/usr/bin/env node
'use strict';

/**
 * Fails when this build breaks something the ORCHESTRATOR requires of it.
 *
 * ---------------------------------------------------------------------------
 * Why this exists, and why it lives here rather than there
 * ---------------------------------------------------------------------------
 *
 * `MarketDataApp/www-marketdata-app` does not copy our build. It READS seven
 * artefacts out of it and REWRITES five, merging them with the marketing half
 * before a single Cloudflare Pages deployment goes out. Every one of its gates
 * fails the deploy rather than degrading, so each is a way a change here stops
 * a production release -- in a repository whose logs we are not reading.
 *
 * The contract was enumerated by that repo on 2026-09-04, during the
 * Docusaurus 3.10 / pnpm migration, in answer to "does my upgrade affect you".
 * The answer was that the contract is much wider than the paths, and that
 * three parts of it a staging deploy cannot show us at all.
 *
 * **One of them cannot be detected there either.** Cloudflare Pages serves the
 * nearest `404.html` by walking up the tree, and ours is what terminates that
 * walk for `/docs/*`. If a build stops emitting it, `/docs/*` silently begins
 * serving the marketing 404 -- and every gate in BOTH repositories stays green,
 * because nothing is missing from either half's point of view. The orchestrator
 * asked us to assert it on this side, in as many words, because it cannot.
 *
 * So this is not a duplicate of their checks. It is the part we can answer
 * before pushing, on a build that exists locally, rather than after a deploy.
 *
 * ---------------------------------------------------------------------------
 * What it reads
 * ---------------------------------------------------------------------------
 *
 * The RAW `build/`, which CI's "Restructure build output" step later nests
 * under `build/docs/`. So a path here is `build/docs/<path>` by the time the
 * orchestrator sees it -- except `404.html`, which CI also lifts to the build
 * root.
 *
 * ---------------------------------------------------------------------------
 * EVERY RULE HERE HAS BEEN SEEN TO FAIL
 * ---------------------------------------------------------------------------
 *
 * A pass from a detector nobody has tested is worth nothing -- the same reason
 * the twins rule treats zero `.md` as a failure rather than a vacuous success.
 * So each rule was run against a deliberately broken build and confirmed to
 * fire, on 2026-09-04:
 *
 *   404.html deleted                      -> fails
 *   sitemap.xml deleted (PROD)            -> fails
 *   sitemap.xml present (staging)         -> fails, the inverted case
 *   llms.txt deleted                      -> fails
 *   llms-full.txt truncated to zero bytes -> fails
 *   _redirects deleted                    -> fails
 *   a stray .md with no backing HTML      -> fails
 *   every .md deleted                     -> fails
 *   HTML moved to <route>.html            -> fails
 *
 * That last one is the important one and it was named by the orchestrator as
 * the most likely way this check passes while its deploy stops: its rule is
 * exactly `existsSync(join(route, "index.html"))`, directory-style, and a
 * looser derivation here would agree with a build it would reject. Moving one
 * page's `index.html` to `<route>.html` fails all three of that route's twins,
 * so the derivation matches.
 *
 * If you add a rule, break its input and watch it fail before trusting it.
 *
 * Usage:  node scripts/check-build-contract.js [--dir build] [--staging]
 */

const { readFileSync, existsSync, statSync, readdirSync } = require('node:fs');
const path = require('node:path');

const argv = process.argv.slice(2);
const dirArg = argv.indexOf('--dir');
const DIR = dirArg === -1 ? 'build' : argv[dirArg + 1];
// A `noIndex` build publishes no sitemap: plugin-sitemap skips it entirely.
// So the sitemap rule inverts rather than relaxing -- on staging, PRESENCE is
// the failure. `PROD` is the same flag docusaurus.config.js gates on.
const PROD = argv.includes('--staging') ? false : process.env.PROD === 'true';

const results = [];
const pass = (id, msg) => results.push({ id, ok: true, msg });
const fail = (id, msg) => results.push({ id, ok: false, msg });

function walk(d, base = d, acc = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, base, acc);
    else acc.push(path.relative(base, p));
  }
  return acc;
}

if (!existsSync(DIR)) {
  console.error(`[build-contract] no build at ${DIR}/ -- run a build first`);
  process.exit(2);
}
const files = walk(DIR);

// --- 404.html -------------------------------------------------------------
// The one the orchestrator explicitly cannot see. See the header.
existsSync(path.join(DIR, '404.html'))
  ? pass('404', "404.html present -- terminates Pages' 404 walk for /docs/*")
  : fail('404', '404.html MISSING -- /docs/* would silently serve the marketing 404, with every gate in both repos green');

// --- sitemap --------------------------------------------------------------
const sitemap = path.join(DIR, 'sitemap.xml');
if (PROD) {
  if (!existsSync(sitemap)) {
    fail('sitemap', 'sitemap.xml MISSING -- the production deploy fails closed on this');
  } else {
    const xml = readFileSync(sitemap, 'utf8');
    const locs = (xml.match(/<loc>/g) ?? []).length;
    if (/<sitemapindex/.test(xml)) fail('sitemap', 'sitemap.xml is a <sitemapindex>; the merge requires a <urlset>');
    else if (!/<urlset/.test(xml)) fail('sitemap', 'sitemap.xml is not a <urlset>');
    else if (locs < 1) fail('sitemap', 'sitemap.xml has no <loc>; an empty one fails the merge');
    else pass('sitemap', `<urlset> with ${locs} <loc>`);
  }
} else {
  existsSync(sitemap)
    ? fail('sitemap', 'sitemap.xml present on a noIndex build -- plugin-sitemap must emit nothing here')
    : pass('sitemap', 'absent, as a noIndex build requires');
}

// --- llms.txt -------------------------------------------------------------
// The orchestrator DEMOTES every heading one level before splicing this into
// the root file, and the demotion has three hard preconditions. The walk is
// fence-aware because a `#` inside a ``` block is not a heading.
const llms = path.join(DIR, 'llms.txt');
if (!existsSync(llms)) {
  fail('llms', 'llms.txt MISSING');
} else {
  let fence = false;
  const headings = [];
  for (const line of readFileSync(llms, 'utf8').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; continue; }
    if (fence) continue;
    const m = /^(#{1,6})\s/.exec(line);
    if (m) headings.push(m[1].length);
  }
  const h1 = headings.filter((l) => l === 1).length;
  const h6 = headings.filter((l) => l === 6).length;
  const problems = [];
  if (h1 !== 1) problems.push(`${h1} H1 (the splice requires exactly 1)`);
  if (headings.length && headings[0] !== 1) problems.push(`first heading is H${headings[0]}, not H1`);
  if (h6) problems.push(`${h6} H6 (demotion would make an H7, which renders as literal text)`);
  problems.length
    ? fail('llms', `llms.txt: ${problems.join('; ')}`)
    : pass('llms', `llms.txt: one H1 first, no H6, ${headings.length} headings -- demotable`);
}

const full = path.join(DIR, 'llms-full.txt');
if (!existsSync(full)) fail('llms-full', 'llms-full.txt MISSING');
else if (statSync(full).size === 0) fail('llms-full', 'llms-full.txt is empty; the splice requires content');
else pass('llms-full', `${(statSync(full).size / 1024).toFixed(0)} KB`);

// --- the Markdown twins ---------------------------------------------------
// The orchestrator walks EVERY .md in the merged build and requires each to
// map to a route whose HTML exists. Zero twins is a hard failure there, and a
// .md whose name is not one of our three twin spellings fails as
// "rules produce X, filename implies Y".
//
// Checking that each twin is BACKED BY ITS HTML covers both: a stray Markdown
// SOURCE landing in the build has no corresponding built page, so it surfaces
// here rather than needing a separate name rule.
//
// The 404 is the one exception, and it is structural rather than a fudge: it
// is a FILE route, so its HTML is `404.html` and no `404/index.html` exists.
// The three names match NOT_FOUND_TWINS in MarketDataApp/website's
// src/lib/markdown-twins.mjs.
const NOT_FOUND_TWINS = new Set(['404.md', path.join('404', 'index.md'), '404.html.md']);
const mds = files.filter((f) => f.endsWith('.md'));
if (!mds.length) {
  fail('twins', 'ZERO .md files -- the orchestrator treats no twins as a hard failure');
} else {
  const orphans = [];
  for (const f of mds) {
    if (NOT_FOUND_TWINS.has(f)) continue;
    const base = path.basename(f);
    const html =
      base === 'index.md' || base === 'index.html.md'
        ? path.join(path.dirname(f), 'index.html')
        : path.join(f.slice(0, -3), 'index.html');
    if (!existsSync(path.join(DIR, html))) orphans.push(`${f} -> ${html}`);
  }
  const seen404 = mds.filter((f) => NOT_FOUND_TWINS.has(f)).length;
  orphans.length
    ? fail('twins', `${orphans.length} .md with no backing HTML (e.g. ${orphans.slice(0, 3).join(' | ')})`)
    : pass('twins', `${mds.length} twins, each backed by its HTML (+${seen404}/3 expected 404 twins)`);
}

// --- _redirects, and the two shared budgets -------------------------------
// REPORTED, NOT GATED, because neither number is ours alone.
//
// Cloudflare charges dynamic slots POSITIONALLY: the first rule containing a
// splat or a :placeholder clears `canCreateStaticRule`, and every rule after
// it takes a dynamic slot, literals included. On 2026-08-31 seven splats added
// in THIS repo pushed 173 of the WEBSITE's rules off the end and onto 404,
// with every check in both repositories green.
//
// BUT POSITION IS NOT THE NUMBER TO WATCH, and that correction came from the
// orchestrator on 2026-09-04, measured on our actual file rather than reasoned
// about. Its check-redirects.mjs --fix HOISTS every pattern rule to the foot
// before deploying, so ordering is repaired for us:
//
//   before --fix:  346 rules: 138 static, 101 of 100 dynamic  -> deploy fails
//   after  --fix:  346 rules: 338 static,   8 of 100 dynamic  -> fine
//
// What survives the reorder is the PATTERN COUNT against a 100 budget shared
// with the website, and the TOTAL against a 2000 static budget also shared.
// Those two are printed. The index is printed only because --fix refuses to
// reorder one case: a pattern that shadows a literal below it.
const redirects = path.join(DIR, '_redirects');
if (!existsSync(redirects)) {
  fail('redirects', '_redirects MISSING');
} else {
  const rules = readFileSync(redirects, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  const isDynamic = (l) => {
    const from = l.split(/\s+/)[0];
    return from.includes('*') || /:[A-Za-z]/.test(from);
  };
  const patterns = rules.filter(isDynamic).length;
  const first = rules.findIndex(isDynamic);
  pass(
    'redirects',
    `${rules.length} rules of a 2000 shared static budget; ` +
      `${patterns} pattern(s) of a 100 shared dynamic budget ` +
      `(first pattern at index ${first}, which the orchestrator's --fix hoists)`
  );
}

// --- report ---------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.id.padEnd(11)} ${r.msg}`);
console.log();
if (failed.length) {
  console.error(
    `[build-contract] ${failed.length} of ${results.length} failed. These are the orchestrator's\n` +
      `requirements on build/docs/. A failure here stops a deploy in\n` +
      `MarketDataApp/www-marketdata-app, not a check in this repository.`
  );
  process.exit(1);
}
console.log(`[build-contract] ${results.length} orchestrator requirement(s) met by ${DIR}/`);
