'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT = path.resolve(__dirname, '..', 'check-option-symbols.js');

/** Run the checker over one temp file. Returns { code, out }. */
function run(content, args = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'occ-'));
  const file = path.join(dir, 'page.mdx');
  fs.writeFileSync(file, content, 'utf8');
  try {
    const out = execFileSync('node', [SCRIPT, file, ...args], { encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: `${e.stdout || ''}${e.stderr || ''}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const AT = ['--today', '2026-08-19'];

test('passes when every symbol is still live', () => {
  const r = run('Use `AAPL271217C00250000` in your request.\n', AT);
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /No expired option symbols/);
});

test('fails on an expired symbol', () => {
  const r = run('Use `AAPL250117C00150000`.\n', AT);
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /EXPIRED/);
  assert.match(r.out, /AAPL250117C00150000/);
  assert.match(r.out, /expired 2025-01-17/);
});

test('no exemption for a symbol inside a json fence', () => {
  const r = run('```json\n{"optionSymbol": ["AAPL250117C00150000"]}\n```\n', AT);
  assert.strictEqual(r.code, 1, 'recorded responses are held to the same rule');
});

test('no exemption for a symbol in a comment', () => {
  const r = run('```js\nconsole.log(x); // AAPL250117C00150000\n```\n', AT);
  assert.strictEqual(r.code, 1, 'comments are held to the same rule');
});

test('no exemption for a symbol in prose', () => {
  const r = run('For example, AAPL250117C00150000 expires in January.\n', AT);
  assert.strictEqual(r.code, 1, 'prose is held to the same rule');
});

test('reports the line number of each occurrence', () => {
  const r = run('line one\nline two\n`AAPL250117C00150000`\n', AT);
  assert.match(r.out, /page\.mdx:3/);
});

test('warns before expiry without failing', () => {
  // 2027-12-17 is 61 days after 2027-10-17, inside the default 90-day window.
  const r = run('`AAPL271217C00250000`\n', ['--today', '2027-10-17']);
  assert.strictEqual(r.code, 0, 'a warning must not fail the build');
  assert.match(r.out, /Expiring within 90 days/);
  assert.match(r.out, /2027-12-17/);
});

test('--warn-days widens the warning window', () => {
  const r = run('`AAPL271217C00250000`\n', ['--today', '2027-06-01', '--warn-days', '400']);
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /Expiring within 400 days/);
});

test('flags a non-canonical expiration without failing', () => {
  const r = run('`AAPL300118C00250000`\n', AT);
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /Non-canonical expirations/);
  assert.match(r.out, /2030-01-18/);
});

test('canonical expirations are not reported as drift', () => {
  const r = run('`AAPL271217C00250000` and `AAPL271217P00250000`\n', AT);
  assert.strictEqual(r.code, 0);
  assert.doesNotMatch(r.out, /Non-canonical expirations/);
});

test('ignores text that only looks like a symbol', () => {
  const r = run('Not symbols: ABCDEFG250117C00150000, AAPL25011C00150000, AAPL250117X00150000.\n', AT);
  assert.strictEqual(r.code, 0);
});

test('finds multiple distinct symbols on one line', () => {
  const r = run('`AAPL250117C00150000` and `AAPL240120P00150000`\n', AT);
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /2 distinct/);
});
