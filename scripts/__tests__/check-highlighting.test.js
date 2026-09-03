'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT = path.resolve(__dirname, '..', 'check-highlighting.js');

/** A rendered code block, highlighted or not. */
function block(lang, tokens) {
  const body = tokens.length
    ? tokens.map((t) => `<span class="token ${t}">x</span>`).join('')
    : 'x';
  return `<pre class="prism-code language-${lang}"><code>${body}</code></pre>`;
}

/** Run the checker over a throwaway build directory. Returns { code, out }. */
function run(pages, args = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-'));
  for (const [name, html] of Object.entries(pages)) {
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html, 'utf8');
  }
  try {
    const out = execFileSync('node', [SCRIPT, '--dir', dir, ...args], { encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: `${e.stdout || ''}${e.stderr || ''}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('passes when every language highlights', () => {
  const r = run({
    'index.html': block('csharp', ['keyword', 'string']) + block('java', ['keyword']),
  });
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /Every language highlights/);
});

test('fails when a language never highlights', () => {
  const r = run({
    'index.html': block('csharp', ['plain']) + block('java', ['keyword']),
  });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /No syntax highlighting for 1 language/);
  assert.match(r.out, /csharp/);
  assert.doesNotMatch(r.out, /java {2}—/);
});

test('a language with no tokens at all counts as unhighlighted', () => {
  const r = run({ 'index.html': block('cmd', []) });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /cmd/);
});

test('one plain block does not condemn a language that highlights elsewhere', () => {
  // A one-word shell command has nothing to colour. That is not a missing
  // grammar, and this is why the check is per-language, not per-block.
  const r = run({
    'a.html': block('bash', []),
    'b.html': block('bash', ['function']),
  });
  assert.strictEqual(r.code, 0);
});

test('text is plain on purpose and never fails', () => {
  const r = run({ 'index.html': block('text', []) }, ['--list']);
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /plain on purpose/);
});

test('names the pages holding an unhighlighted block', () => {
  const r = run({
    'api/options/chain/index.html': block('csharp', ['plain']),
  });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /api[/\\]options[/\\]chain[/\\]index\.html/);
});

test('counts blocks across nested directories', () => {
  const r = run({
    'a/index.html': block('go', ['keyword']),
    'b/c/index.html': block('go', ['keyword']),
  }, ['--list']);
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /2 code block/);
});

test('--list prints the table even when everything passes', () => {
  const r = run({ 'index.html': block('php', ['keyword']) }, ['--list']);
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /language\s+blocks\s+highlighted/);
  assert.match(r.out, /php/);
});

test('the tripwire fires when the walk finds almost nothing', () => {
  // A "the walk found nothing" guard, not a content baseline: it asks whether
  // the walk found anything at all, which only the mechanism can change. The
  // real floor is 50 pages against 271; `--floor` drives the same branch here.
  const r = run({ 'index.html': block('go', ['keyword']) }, ['--floor', '999']);
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /below the floor of 999/);
  assert.match(r.out, /tripwire for a walk that stopped matching/);
  assert.match(r.out, /Do not lower the floor/);
});

test('a missing build directory is an error, not a pass', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-'));
  fs.rmSync(dir, { recursive: true, force: true });
  let code = 0;
  let out = '';
  try {
    execFileSync('node', [SCRIPT, '--dir', dir], { encoding: 'utf8' });
  } catch (e) {
    code = e.status;
    out = `${e.stdout || ''}${e.stderr || ''}`;
  }
  assert.strictEqual(code, 1);
  assert.match(out, /No build at/);
});
