#!/usr/bin/env node
/**
 * check-option-symbols.js
 *
 * Fails when any OCC option symbol in the docs has already expired.
 *
 * An expired symbol is a defect that appears with the passage of time rather
 * than with a code change: nothing in the diff is wrong on the day it is
 * written, the page keeps rendering, and the example silently stops working.
 * Code review cannot catch that, so CI has to.
 *
 * There are no exemptions. A symbol in a recorded JSON response, in a comment,
 * or in a printed output block is held to the same rule as one in a request:
 * a reader who copies any symbol off the page, or compares their own output to
 * ours, should be looking at a contract that still trades.
 *
 * Usage:
 *   node scripts/check-option-symbols.js                  # check (exit 1 on expired)
 *   node scripts/check-option-symbols.js --warn-days 120  # widen the warning tier
 *   node scripts/check-option-symbols.js --today 2028-01-01
 *   node scripts/check-option-symbols.js api/options/quotes.mdx
 *
 * With no path arguments it scans SCAN_DIRS. With paths it checks only those
 * files, which is what the pre-commit hook relies on.
 *
 * Exit codes
 *   0  nothing expired (warnings may still print)
 *   1  at least one expired symbol
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// llm-docs/ is generated from these sources and is not tracked, so fixing a
// source fixes it. sop/ is a separate private repo mounted in an ignored dir.
const SCAN_DIRS = ['api', 'sdk', 'sheets', 'account', 'docs'];
const SKIP_DIRS = new Set(['node_modules', 'build', 'llm-docs', 'sop', '.git', '.docusaurus']);

// The contracts every example should use. When one of these nears expiry the
// warning tier fires first, so the whole corpus is migrated on purpose rather
// than discovered broken. See issue #167.
const CANONICAL = new Set(['AAPL271217C00250000', 'AAPL271217P00250000']);

// Drift is tracked by expiration date, not by symbol. A single chain response
// legitimately contains a hundred strikes on one expiration; what matters is
// whether a *new* expiration has crept in that nobody will remember to migrate.
const CANONICAL_EXPIRIES = new Set(['2027-12-17', '2028-12-15']);

// OCC: root (1-6 alnum, letter first) + YYMMDD + C|P + strike (8 digits)
const OCC = /\b([A-Z][A-Z0-9]{0,5})(\d{6})([CP])(\d{8})\b/g;

function parseArgs(argv) {
  const out = { files: [], warnDays: 90, today: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--warn-days') out.warnDays = Number(argv[++i]);
    else if (a === '--today') out.today = argv[++i];
    else if (a.startsWith('--')) continue;
    else out.files.push(a);
  }
  return out;
}

/** YYMMDD -> YYYY-MM-DD. OCC carries no century; 00-99 maps to 2000-2099. */
function expiryOf(yymmdd) {
  return `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
}

function daysBetween(fromISO, toISO) {
  const MS = 86400000;
  return Math.round((Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`)) / MS);
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  const today = args.today || new Date().toISOString().slice(0, 10);

  const files = args.files.length
    ? args.files.map((f) => path.resolve(ROOT, f)).filter((f) => fs.existsSync(f))
    : SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d), []));

  const expired = new Map();   // symbol -> [{rel, line}]
  const expiring = new Map();  // expiry -> { days, count }
  const offCanon = new Map();  // expiry -> { count, files:Set }

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    let src;
    try {
      src = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      OCC.lastIndex = 0;
      let m;
      while ((m = OCC.exec(lines[i])) !== null) {
        const symbol = m[0];
        const exp = expiryOf(m[2]);
        const days = daysBetween(today, exp);
        if (days < 0) {
          if (!expired.has(symbol)) expired.set(symbol, []);
          expired.get(symbol).push({ rel, line: i + 1, exp, days });
        } else {
          if (days <= args.warnDays) {
            const cur = expiring.get(exp) || { days, count: 0 };
            cur.count++;
            expiring.set(exp, cur);
          }
          if (!CANONICAL_EXPIRIES.has(exp)) {
            const cur = offCanon.get(exp) || { count: 0, files: new Set() };
            cur.count++;
            cur.files.add(rel);
            offCanon.set(exp, cur);
          }
        }
      }
    }
  }

  console.log(`Checked ${files.length} file(s) as of ${today}.\n`);

  if (expired.size) {
    const total = [...expired.values()].reduce((n, v) => n + v.length, 0);
    console.log(`EXPIRED option symbols (${expired.size} distinct, ${total} occurrence(s)):\n`);
    for (const [symbol, hits] of [...expired].sort()) {
      const { exp, days } = hits[0];
      console.log(`  ${symbol}  expired ${exp}  (${Math.abs(days)} days ago)  x${hits.length}`);
      for (const h of hits.slice(0, 6)) console.log(`      ${h.rel}:${h.line}`);
      if (hits.length > 6) console.log(`      ... and ${hits.length - 6} more`);
    }
    console.log('');
  }

  if (expiring.size) {
    console.log(`Expiring within ${args.warnDays} days — migrate before they break:\n`);
    for (const [exp, v] of [...expiring].sort()) {
      console.log(`  expiration ${exp}  (in ${v.days} days)  ${v.count} symbol occurrence(s)`);
    }
    console.log('');
  }

  if (offCanon.size) {
    console.log(`Non-canonical expirations in use (${offCanon.size}):\n`);
    for (const [exp, v] of [...offCanon].sort()) {
      const where = [...v.files].slice(0, 3).join(', ');
      console.log(`  ${exp}  ${v.count} occurrence(s)  ${where}${v.files.size > 3 ? ', ...' : ''}`);
    }
    console.log(`\n  Canonical expirations: ${[...CANONICAL_EXPIRIES].join(', ')}  (issue #167)`);
    console.log('  Not an error — but each one is a separate future breakage to remember.\n');
  }

  if (expired.size) {
    console.log('Every option symbol in the docs must still trade — including ones in');
    console.log('JSON responses, comments, and printed output. Replace each with a live');
    console.log('contract and re-record any sample output so its other fields agree.');
    console.log('');
    console.log(`Canonical: ${[...CANONICAL].join(', ')}`);
    process.exit(1);
  }

  console.log('No expired option symbols.');
  process.exit(0);
}

main();
