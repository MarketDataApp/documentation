#!/usr/bin/env node
/**
 * check-example-parity.js
 *
 * Fails when the language tabs on one API page do not demonstrate the same
 * request.
 *
 * A reader switching from Python to Java on an endpoint page is asking one
 * question: how does this language spell the call? If the Java tab also
 * changes the ticker, drops a date range, or adds a filter its siblings do
 * not have, the page answers a question nobody asked and the reader has to
 * diff two examples to find the one line that matters.
 *
 * The rule, from issue #167: if a tab on a page passes a parameter, every tab
 * on that page passes it. Same tickers, same dates, same filters, one fixture
 * per data type across the whole corpus.
 *
 * This drifts the same way expired symbols do — a tab added months after its
 * siblings is not wrong in its own diff — so CI has to hold the line rather
 * than review. See scripts/check-option-symbols.js, which guards the other
 * half of #167.
 *
 * What is compared is a *normalised* fixture set, not the source text: each
 * language spells a date its own way, and that is the difference the page
 * exists to show.
 *
 *   2024-01-01  ==  LocalDate.of(2024, 1, 1)  ==  new DateOnly(2024, 1, 1)
 *
 * Comments are stripped first. A tab that prints the resulting OCC symbol in
 * a trailing comment has not made a different request.
 *
 * Usage:
 *   node scripts/check-example-parity.js          # check (exit 1 on divergence)
 *   node scripts/check-example-parity.js --list   # print every group, including OK
 *   node scripts/check-example-parity.js api/markets/status.mdx
 *
 * Exit codes
 *   0  every page's tabs agree
 *   1  at least one page's tabs disagree
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Only the REST endpoint pages. The sdk/** sections document one language by
// definition, so tab parity is not a question there.
const SCAN_DIRS = ['api'];
const SKIP_DIRS = new Set(['node_modules', 'build', 'llm-docs', 'sop', '.git', '.docusaurus']);

// A tab is a language tab when its label is one of these. Pages also use
// TabItem for "Single Symbol"/"Multiple Symbols" and for parameter groups;
// those nest, and each nesting path is compared as its own group.
const LANGUAGES = new Set([
  'HTTP', 'JavaScript', 'TypeScript', 'Python', 'Go', 'PHP', 'Java', 'Kotlin', 'C#',
]);

// The canonical fixtures, from #167 — one per data type, used on every page
// and in every language. This set IS the compared vocabulary: a bare uppercase
// word is otherwise indistinguishable from an enum member (Resolution.DAILY,
// Side::CALL), and treating those as tickers reports drift that is not there.
//
// A page that needs a genuinely new ticker adds it here. That is the same
// discipline #167 asks for -- one fixture per data type, chosen on purpose --
// and it is why the check reports, without failing, any ticker-shaped word it
// finds in a string literal that is not on this list.
const KNOWN_TICKERS = new Set(['AAPL', 'META', 'MSFT', 'VFINX', 'SPY', 'QQQ']);

const ISO_DATE = /\b(20\d{2})-(\d{2})-(\d{2})\b/g;
// LocalDate.of(2024, 1, 1) / new DateOnly(2024, 1, 1) / date(2024, 1, 31)
const CTOR_DATE = /\((20\d{2}),\s*(\d{1,2}),\s*(\d{1,2})\)/g;
const TICKER = /\b[A-Z]{1,5}\b/g;
// Only string literals and URLs can hold a symbol; an enum member cannot.
const STRING_LITERAL = /"[^"\n]*"|'[^'\n]*'|`[^`]*`|https?:\/\/\S+/g;
const OCC = /\b[A-Z][A-Z0-9]{0,5}\d{6}[CP]\d{8}\b/g;

// Words that look like tickers but are language, not fixtures.
const NOT_A_TICKER = new Set([
  'GET', 'POST', 'HTTP', 'HTTPS', 'JSON', 'API', 'URL', 'SDK', 'ID', 'UTC', 'ET',
  'TRUE', 'FALSE', 'NULL', 'NONE', 'AND', 'OR', 'IF', 'FOR', 'NEW', 'VAR', 'USE',
  'D', 'W', 'M', 'Y', 'C', 'P', 'US',
  // Exchange and standards names that appear in prose, not as symbols.
  'IEX', 'OPRA', 'SIP', 'NBBO',
]);

function parseArgs(argv) {
  const out = { files: [], list: false };
  for (const a of argv) {
    if (a === '--list') out.list = true;
    else if (a.startsWith('--')) continue;
    else out.files.push(a);
  }
  return out;
}

function walk(dir, acc) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (/\.mdx?$/i.test(e.name)) acc.push(full);
  }
  return acc;
}

/**
 * Drop comments, and the code-fence lines themselves. The fence carries a
 * `title="stockCandles.php"` that is a filename, not a fixture, and its
 * backticks otherwise read as one giant template literal that swallows the
 * whole block.
 *
 * A tab that echoes its own result in a trailing comment made the same
 * request as the tab that did not.
 */
function stripComments(src) {
  return src
    .replace(/^```.*$/gm, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|\s)\/\/[^\n]*/g, ' ')
    .replace(/(^|\s)#[^\n]*/g, ' ');
}

/**
 * The fixtures one tab uses, in a form comparable across languages.
 * Returns a sorted array of tokens such as "2024-01-01" or "AAPL".
 */
function fixturesOf(tabSource) {
  const src = stripComments(tabSource);
  const found = new Set();

  for (const m of src.matchAll(ISO_DATE)) {
    found.add(`${m[1]}-${m[2]}-${m[3]}`);
  }
  for (const m of src.matchAll(CTOR_DATE)) {
    found.add(`${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`);
  }
  for (const m of src.matchAll(OCC)) {
    found.add(m[0]);
  }
  for (const m of src.matchAll(TICKER)) {
    if (KNOWN_TICKERS.has(m[0])) found.add(m[0]);
  }
  return [...found].sort();
}

/**
 * Ticker-shaped words in this tab's string literals that are not canonical
 * fixtures. Advisory only -- a new endpoint may legitimately need a new
 * symbol; the point is that adopting one is a decision, not a default.
 */
function offFixtureTickers(tabSource) {
  const src = stripComments(tabSource);
  const found = new Set();
  for (const lit of src.match(STRING_LITERAL) || []) {
    // An interpolated template is a formatted output line -- `FY${year} Q${q}`
    // -- not a symbol being passed to the API.
    if (lit.startsWith('`') && lit.includes('${')) continue;
    for (const m of lit.matchAll(TICKER)) {
      if (!KNOWN_TICKERS.has(m[0]) && !NOT_A_TICKER.has(m[0])) found.add(m[0]);
    }
  }
  return found;
}

/**
 * Every innermost TabItem, with the path of the outer tabs that contain it.
 * Nested tabs are separate groups: "Single Symbol" and "Multiple Symbols"
 * demonstrate different requests on purpose.
 */
function tabsOf(body, prefix = '') {
  const out = [];
  const open = /<TabItem\s+value="([^"]+)"(?:\s+label="([^"]*)")?[^>]*>/g;
  let m;
  while ((m = open.exec(body)) !== null) {
    const label = m[2] || m[1];
    // Scan forward to the matching close, counting nested TabItems.
    let depth = 1;
    const bodyStart = m.index + m[0].length;
    let end = body.length;
    const token = /<TabItem\b|<\/TabItem>/g;
    token.lastIndex = bodyStart;
    let t;
    while ((t = token.exec(body)) !== null) {
      depth += t[0] === '</TabItem>' ? -1 : 1;
      if (depth === 0) {
        end = t.index;
        break;
      }
    }
    const seg = body.slice(bodyStart, end);
    if (/<TabItem\b/.test(seg)) out.push(...tabsOf(seg, `${prefix}${label} > `));
    else out.push({ group: prefix, label, source: seg });
    open.lastIndex = end;
  }
  return out;
}

/**
 * Every top-level `<Tabs>` block in a page, as source text.
 *
 * This used to read only the "## Request Example" section, and that was a
 * fail-open: renaming the heading dropped a page's nine tabs out of the check
 * silently -- 16 groups became 15, exit 0, no complaint. Worse, it was already
 * happening. Five pages keep their language tabs under other headings
 * (`### Code Examples` on api/authentication.mdx), so 38 tabs had never been
 * compared by anything, while #167 recorded those pages as consistent from a
 * hand audit.
 *
 * Nothing is matched by heading now. Every `<Tabs>` block is read wherever it
 * sits, so there is no name for an edit to get wrong.
 *
 * They are returned SEPARATELY, and that is the reason this is not simply
 * `tabsOf(wholeFile)`: two independent blocks on one page demonstrate two
 * different requests on purpose, and flattening them would compare a chain
 * request against a status request and fail an entirely correct page.
 */
function tabsBlocks(src) {
  const out = [];
  const open = /<Tabs\b[^>]*>/g;
  let m;
  while ((m = open.exec(src)) !== null) {
    let depth = 1;
    const start = m.index + m[0].length;
    let end = src.length;
    const token = /<Tabs\b[^>]*>|<\/Tabs>/g;
    token.lastIndex = start;
    let t;
    while ((t = token.exec(src)) !== null) {
      depth += t[0] === '</Tabs>' ? -1 : 1;
      if (depth === 0) {
        end = t.index;
        break;
      }
    }
    out.push(src.slice(start, end));
    open.lastIndex = end;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = args.files.length
    ? args.files.map((f) => path.resolve(ROOT, f)).filter((f) => fs.existsSync(f))
    : SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d), []));

  const problems = [];
  const unknownTickers = new Map(); // ticker -> Set<rel>
  let groupCount = 0;

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    let src;
    try {
      src = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const blocks = tabsBlocks(src);
    if (blocks.length === 0) continue;

    const byGroup = new Map();
    // The block index keeps two independent <Tabs> on one page apart; without
    // it both would carry the same empty nesting path and be merged.
    blocks.forEach((block, blockIndex) => {
    for (const tab of tabsOf(block)) {
      if (!LANGUAGES.has(tab.label)) continue;
      const fixtures = fixturesOf(tab.source);
      for (const t of offFixtureTickers(tab.source)) {
        if (!unknownTickers.has(t)) unknownTickers.set(t, new Set());
        unknownTickers.get(t).add(rel);
      }
      const key = `${blockIndex}\u0000${tab.group}`;
      if (!byGroup.has(key)) byGroup.set(key, new Map());
      byGroup.get(key).set(tab.label, fixtures);
    }
    });

    for (const [key, tabs] of byGroup) {
      const group = key.slice(key.indexOf('\u0000') + 1);
      if (tabs.size < 2) continue;
      groupCount++;
      const distinct = new Set([...tabs.values()].map((f) => f.join(',')));
      if (distinct.size === 1) {
        if (args.list) console.log(`OK   ${rel}${group ? `  [${group.trim()}]` : ''}  ${tabs.size} tabs`);
        continue;
      }
      problems.push({ rel, group, tabs });
    }
  }

  console.log(`Checked ${files.length} file(s), ${groupCount} tab group(s).\n`);

  if (problems.length) {
    console.log(`Language tabs demonstrate different requests (${problems.length} group(s)):\n`);
    for (const { rel, group, tabs } of problems) {
      console.log(`  ${rel}${group ? `  [${group.trim()}]` : ''}`);
      // Show the majority signature first, so the odd tab out is obvious.
      const tally = new Map();
      for (const f of tabs.values()) {
        const k = f.join(',');
        tally.set(k, (tally.get(k) || 0) + 1);
      }
      const majority = [...tally].sort((a, b) => b[1] - a[1])[0][0];
      for (const [label, f] of tabs) {
        const mark = f.join(',') === majority ? ' ' : '*';
        console.log(`    ${mark} ${label.padEnd(12)} ${f.join(', ') || '(no fixtures)'}`);
      }
      console.log('');
    }
    console.log('Every language tab on a page must make the same request with the same');
    console.log('inputs, so switching tabs shows how the language differs and nothing');
    console.log('else. If one tab passes a parameter, every tab passes it. (issue #167)');
    console.log('');
    console.log('Lines marked * differ from the majority of tabs on that page.');
    process.exit(1);
  }

  if (unknownTickers.size) {
    console.log(`Tickers outside the canonical fixture set (${unknownTickers.size}):\n`);
    for (const [t, where] of [...unknownTickers].sort()) {
      console.log(`  ${t}  ${[...where].slice(0, 3).join(', ')}`);
    }
    console.log(`\n  Canonical: ${[...KNOWN_TICKERS].join(', ')}  (issue #167)`);
    console.log('  Not an error — but a new fixture is one more symbol to keep alive.\n');
  }

  console.log('Every page shows the same request in every language tab.');
  process.exit(0);
}

if (require.main === module) main();

module.exports = { fixturesOf, offFixtureTickers, tabsOf, tabsBlocks, stripComments };
