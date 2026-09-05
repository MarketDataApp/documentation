#!/usr/bin/env node
'use strict';

/**
 * No MDX directive survives into the rendered page as literal text.
 *
 * ---------------------------------------------------------------------------
 * Why this exists
 * ---------------------------------------------------------------------------
 *
 * `:::info Root Endpoint` is MDX v1 admonition syntax. With
 * `future.v4.mdx1CompatDisabledByDefault` it is not parsed at all -- and it
 * does not fail. The whole line is emitted as ordinary paragraph text:
 *
 *     <p>:::info Root Endpoint
 *     <a href=https://api.marketdata.app/ ...
 *
 * The supported spelling is `:::info[Root Endpoint]`. 74 openers across 56
 * files used the old one, and every one of them shipped to staging looking
 * like this before a reader noticed.
 *
 * ---------------------------------------------------------------------------
 * WHY IT WAS NOT CAUGHT, WHICH IS THE REASON THE CHECK IS SHAPED THIS WAY
 * ---------------------------------------------------------------------------
 *
 * The upgrade was verified by grepping the built HTML for an admonition's
 * title and finding it on the same number of pages before and after. That
 * proved the string was present. It could not tell a rendered TITLE from
 * literal body text, because both contain the string -- so the check said
 * "unaffected" about a page that was visibly broken.
 *
 * A count is not a gate. This asserts the STRUCTURE instead: after removing
 * code, no rendered text may begin a line with `:::`, because a parsed
 * directive leaves no marker behind and an unparsed one leaves exactly that.
 *
 * Code is excluded on purpose -- `<pre>` and `<code>` legitimately contain
 * `:::` when the docs describe admonition syntax.
 *
 * Usage: pnpm run build && node scripts/check-directives.js [--dir build]
 */

const fs = require('node:fs');
const path = require('node:path');
const domino = require('@mixmark-io/domino');

const ROOT = path.resolve(__dirname, '..');
const dirArg = process.argv.indexOf('--dir');
const DIR = path.resolve(ROOT, dirArg === -1 ? 'build' : process.argv[dirArg + 1]);

/**
 * A floor, not a content baseline. This check reads pages it finds itself, so
 * a walk that stopped matching would report a clean bill of health forever.
 */
const MINIMUM_PAGES = 200;

/** Every directive spelling Docusaurus parses, plus the generic `:::x` form. */
const LEAKED = /(^|\n)\s*:::[a-zA-Z]/;

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (entry.name === 'index.html' || entry.name === '404.html') acc.push(p);
  }
  return acc;
}

if (!fs.existsSync(DIR)) {
  console.error(`No build at ${path.relative(ROOT, DIR)}/ -- run \`pnpm run build\` first.`);
  process.exit(2);
}

const pages = walk(DIR);
if (pages.length < MINIMUM_PAGES) {
  console.error(
    `Only ${pages.length} page(s) under ${path.relative(ROOT, DIR)}/, below the floor of ${MINIMUM_PAGES}.\n\n` +
      'This is a tripwire for a walk that stopped matching, not a content baseline.\n' +
      'Do not lower the floor to make it pass.'
  );
  process.exit(1);
}

const offenders = [];
for (const file of pages) {
  const doc = domino.createDocument(fs.readFileSync(file, 'utf8'));
  const main = doc.querySelector('main') || doc.body;
  if (!main) continue;

  // Drop code before reading text: a page documenting admonition syntax shows
  // `:::note` inside a fence, and that is content rather than a leak.
  for (const tag of ['pre', 'code']) {
    for (const el of Array.prototype.slice.call(main.getElementsByTagName(tag))) {
      if (el.parentNode) el.parentNode.removeChild(el);
    }
  }

  const text = main.textContent || '';
  const hit = LEAKED.exec(text);
  if (hit) {
    const at = text.indexOf(':::', hit.index);
    offenders.push({
      file: path.relative(DIR, file),
      sample: text.slice(at, at + 70).split('\n')[0].trim(),
    });
  }
}

console.log(`Checked ${pages.length} page(s) for unparsed MDX directives.\n`);

if (offenders.length) {
  console.error('These pages render a directive as literal text:\n');
  for (const { file, sample } of offenders.slice(0, 25)) {
    console.error(`  ${file}\n      ${sample}`);
  }
  if (offenders.length > 25) console.error(`  ... and ${offenders.length - 25} more`);
  console.error(
    `\n${offenders.length} page(s) affected.\n\n` +
      'Almost always MDX v1 admonition syntax. `:::info Some Title` is not parsed\n' +
      'with mdx1Compat disabled; the supported spelling is `:::info[Some Title]`.\n' +
      'The build does not fail on this -- the directive just becomes a paragraph.'
  );
  process.exit(1);
}

console.log('Every directive parsed; none reached the page as text.');
