#!/usr/bin/env node
/**
 * check-highlighting.js
 *
 * Fails when a ``` fence language produces no syntax highlighting anywhere in
 * the built site.
 *
 * Prism only highlights languages it has a grammar for. Docusaurus bundles a
 * handful and every other one has to be named in `additionalLanguages` in
 * docusaurus.config.js. Miss one and nothing complains: the build succeeds,
 * the page renders, the block still looks like a code block — it is just grey.
 * `csharp` was missing while 99 fences used it, and the only thing that ever
 * catches that is a person browsing a page and noticing.
 *
 * The same silence covers a fence tagged with something that is not a Prism
 * language id at all — ```env, ```cmd — which is easy to write because both
 * name the thing in the block correctly. Prism calls them `ini` and `batch`.
 *
 * What is checked, and why it is per-language rather than per-block: a single
 * block can legitimately produce no tokens (a one-word shell command has
 * nothing to colour). A language where *no* block anywhere produces a token is
 * a missing grammar. So this fails on the language, not on the block.
 *
 * Run it after a build — it reads build/, not the sources.
 *
 * Usage:
 *   yarn build && node scripts/check-highlighting.js
 *   node scripts/check-highlighting.js --dir some/other/build
 *   node scripts/check-highlighting.js --list   # per-language counts, always
 *
 * Exit codes
 *   0  every language highlights somewhere
 *   1  at least one language never highlights
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Languages that render as plain text on purpose. `text` is the standard way
// to ask for a code block with no highlighting at all.
const INTENTIONALLY_PLAIN = new Set(['text', 'plaintext', 'none', 'nohighlight']);

const BLOCK = /<pre[^>]*class="[^"]*language-([a-z0-9#+_-]+)[^"]*"[^>]*>([\s\S]*?)<\/pre>/g;
const TOKEN = /class="token ([a-z-]+)/g;

// Directories with no rendered code blocks in them.
const SKIP_DIRS = new Set(['assets', 'img', 'fonts']);

function parseArgs(argv) {
  const out = { dir: path.join(ROOT, 'build'), list: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') out.dir = path.resolve(ROOT, argv[++i]);
    else if (argv[i] === '--list') out.list = true;
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
    else if (e.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

/**
 * Per-language totals across the built site.
 * Returns Map<lang, { blocks, highlighted, pages:Set<string> }>.
 */
function scan(dir, files) {
  const stats = new Map();
  for (const file of files) {
    let html;
    try {
      html = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    BLOCK.lastIndex = 0;
    let m;
    while ((m = BLOCK.exec(html)) !== null) {
      const [, lang, body] = m;
      if (!stats.has(lang)) stats.set(lang, { blocks: 0, highlighted: 0, pages: new Set() });
      const st = stats.get(lang);
      st.blocks++;
      TOKEN.lastIndex = 0;
      let t;
      let hasReal = false;
      while ((t = TOKEN.exec(body)) !== null) {
        if (t[1] !== 'plain') {
          hasReal = true;
          break;
        }
      }
      if (hasReal) st.highlighted++;
      else st.pages.add(path.relative(dir, file));
    }
  }
  return stats;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.dir)) {
    console.error(`No build at ${path.relative(ROOT, args.dir)} — run \`yarn build\` first.`);
    process.exit(1);
  }

  const files = walk(args.dir, []);
  const stats = scan(args.dir, files);

  console.log(`Checked ${files.length} page(s), ${[...stats.values()].reduce((n, s) => n + s.blocks, 0)} code block(s).\n`);

  const dead = [...stats].filter(([lang, st]) => !INTENTIONALLY_PLAIN.has(lang) && st.highlighted === 0);

  if (args.list || dead.length) {
    const rows = [...stats].sort((a, b) => b[1].blocks - a[1].blocks);
    console.log(`  ${'language'.padEnd(16)}${'blocks'.padStart(8)}${'highlighted'.padStart(13)}`);
    for (const [lang, st] of rows) {
      const note = INTENTIONALLY_PLAIN.has(lang)
        ? '  (plain on purpose)'
        : st.highlighted === 0
          ? '  <-- no grammar'
          : '';
      console.log(`  ${lang.padEnd(16)}${String(st.blocks).padStart(8)}${String(st.highlighted).padStart(13)}${note}`);
    }
    console.log('');
  }

  if (dead.length) {
    console.log(`No syntax highlighting for ${dead.length} language(s):\n`);
    for (const [lang, st] of dead) {
      console.log(`  ${lang}  — ${st.blocks} block(s), none highlighted`);
      for (const p of [...st.pages].slice(0, 3)) console.log(`      ${p}`);
      if (st.pages.size > 3) console.log(`      ... and ${st.pages.size - 3} more page(s)`);
    }
    console.log('');
    console.log('Either the grammar is not registered, or the fence names something');
    console.log('Prism does not call a language. Two fixes:');
    console.log('');
    console.log('  1. Add the language to `additionalLanguages` in docusaurus.config.js,');
    console.log('     if Prism ships a grammar for it (prismjs/components/prism-<lang>.js).');
    console.log('  2. Retag the fence with the id Prism uses — ```ini not ```env,');
    console.log('     ```batch not ```cmd — if it does not.');
    console.log('');
    console.log('A block meant to stay unhighlighted should be tagged ```text.');
    process.exit(1);
  }

  console.log('Every language highlights.');
  process.exit(0);
}

if (require.main === module) main();

module.exports = { scan, walk, INTENTIONALLY_PLAIN };
