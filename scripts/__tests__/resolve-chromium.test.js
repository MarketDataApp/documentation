'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const SCRIPT = path.resolve(__dirname, '..', 'resolve-chromium.js');

/**
 * Run the resolver as CI runs it. Returns { code, out }.
 *
 * CI chains this exit code (`node scripts/resolve-chromium.js || npx playwright
 * install ...`), so the code is a contract, not a detail.
 */
function run(env) {
  try {
    const out = execFileSync('node', [SCRIPT], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

test('CHROMIUM_PATH wins when it points at an executable', () => {
  // `node` itself: an executable that exists on every machine running this test.
  const { code, out } = run({ CHROMIUM_PATH: process.execPath });
  assert.strictEqual(code, 0);
  assert.match(out, new RegExp(`Chromium: ${process.execPath} \\(system\\)`));
});

test('an unusable CHROMIUM_PATH falls back to the bundled build, and says so', () => {
  const { code, out } = run({ CHROMIUM_PATH: '/nonexistent/chromium' });
  assert.strictEqual(code, 1, 'exit 1 tells CI to install Playwright’s build');
  assert.match(out, /bundled with @playwright\/test/);
});

test('with no override it reports one answer, and the exit code matches it', () => {
  const { code, out } = run({ CHROMIUM_PATH: '' });
  if (code === 0) {
    assert.match(out, /^Chromium: \S.*\(system\)$/m);
  } else {
    assert.strictEqual(code, 1);
    assert.match(out, /bundled with @playwright\/test/);
  }
});
