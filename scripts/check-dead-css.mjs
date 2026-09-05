#!/usr/bin/env node
'use strict';

/**
 * Every class our own CSS names that NO built page carries.
 *
 * ---------------------------------------------------------------------------
 * The defect it exists for
 * ---------------------------------------------------------------------------
 *
 * `src/css/custom.css` targeted `.tabItem_Ymn6` -- a HASHED CSS-module class
 * from @docusaurus/theme-classic. The suffix follows the module's resolved
 * path, so moving from yarn to pnpm renamed it to `tabItem_VFbg` and the rule
 * silently matched nothing: valid CSS naming a class no element carries. Tab
 * backgrounds vanished from 104 pages with no build error and no warning.
 *
 * A Docusaurus upgrade moves such a name exactly the same way. Nothing else in
 * this repo can see it -- the CSS is valid, the build is green, the page
 * renders, and only the styling is absent.
 *
 * ---------------------------------------------------------------------------
 * Why it lives in scripts/ and not where it was written
 * ---------------------------------------------------------------------------
 *
 * It was written in a gitignored scratch directory during the 3.10 migration
 * and left there. On 2026-09-05 `MarketData-App/website` found that ITS only
 * detector for a `/docs/` 404 walk-up regression was likewise sitting in a
 * gitignored `.scratch/`, had broken on an attribute-quoting assumption, and
 * had accused this repository of a defect it did not have. An instrument you
 * rely on cannot live somewhere that is not committed: it is invisible to
 * review, absent from a fresh clone, and audits of "the checks" never find it.
 *
 * ---------------------------------------------------------------------------
 * What it cannot tell you
 * ---------------------------------------------------------------------------
 *
 * A class added by JavaScript after hydration is absent from the built HTML and
 * looks dead here. Two are, and both are real: `.hidden` is toggled at runtime,
 * and `.user-profile-wrapper` comes from @marketdataapp/ui's client-rendered
 * navbar item. They are listed in KNOWN_RUNTIME below rather than suppressed by
 * a count, so a THIRD one shows up as news.
 *
 * Usage: pnpm run build && node scripts/check-dead-css.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const dirArg = process.argv.indexOf('--dir');
const dir = dirArg === -1 ? 'build' : process.argv[dirArg + 1];
const cssFiles = ['src/css/custom.css'];

/**
 * Classes our CSS names that only ever exist after hydration, so the built
 * HTML cannot carry them. Listed, not counted: an unexpected third entry is
 * the signal this check exists to give.
 */
const KNOWN_RUNTIME = new Set(['hidden', 'user-profile-wrapper']);

if (!existsSync(dir)) {
  console.error(`No build at ${dir}/ -- run \`pnpm run build\` first.`);
  process.exit(2);
}

async function walk(d, base = d, acc = []) {
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) await walk(p, base, acc);
    else if (e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

// Collect every class token that appears in a class="..." attribute anywhere.
const present = new Set();
for (const f of await walk(dir)) {
  const html = readFileSync(f, 'utf8');
  // Quote-agnostic ON PURPOSE. Under future.v4 the Faster pipeline minifies
  // harder and emits UNQUOTED attributes -- `class=foo` and `id=bar` -- so a
  // pattern requiring quotes reports every single-class element as missing.
  // That produced five false "dead" selectors the first time this ran on a v4
  // build, which is a good reminder that a checker over built HTML is itself
  // exposed to how the build spells things.
  for (const m of html.matchAll(/class=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))
    for (const c of (m[1] ?? m[2] ?? m[3] ?? '').split(/\s+/)) if (c) present.add(c);
}

// Class selectors our CSS declares. Only bare `.name` tokens -- enough to find
// a name that has gone away, which is the failure this exists for.
const declared = new Map();
for (const file of cssFiles) {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
    const name = m[1];
    if (!declared.has(name)) declared.set(name, file);
  }
}

const dead = [...declared.keys()].filter((c) => !present.has(c)).sort();
const runtime = dead.filter((c) => KNOWN_RUNTIME.has(c));
const unexpected = dead.filter((c) => !KNOWN_RUNTIME.has(c));

console.log(`${present.size} distinct classes in the build; ${declared.size} named by our CSS.`);
if (runtime.length) console.log(`${runtime.length} known runtime-only: ${runtime.map((c) => '.' + c).join(', ')}`);

// A known runtime class that HAS started appearing means the list is stale --
// the same rule the external-link check applies to its known-broken list, so
// neither becomes a graveyard.
const nowPresent = [...KNOWN_RUNTIME].filter((c) => present.has(c));
if (nowPresent.length) {
  console.error(`\nA known runtime-only class now appears in the built HTML: ${nowPresent.map((c) => '.' + c).join(', ')}`);
  console.error('Delete its KNOWN_RUNTIME entry -- the list has stopped describing the build.');
  process.exit(1);
}

if (unexpected.length) {
  console.error(`\n${unexpected.length} class(es) our CSS names that NO built page carries:\n`);
  for (const c of unexpected) console.error(`  .${c}   (${declared.get(c)})`);
  console.error(
    '\nA rule naming a class nothing has is valid CSS that styles nothing, and\n' +
      'nothing else reports it. The usual cause is a HASHED CSS-module class from\n' +
      'the theme, whose suffix moves with the package manager or the Docusaurus\n' +
      'version. Target something the theme promises instead -- an unhashed class\n' +
      'or an ARIA role. If the class is genuinely added at runtime, add it to\n' +
      'KNOWN_RUNTIME with a reason.'
  );
  process.exit(1);
}
console.log('\nEvery class our CSS names is carried by at least one built page.');
