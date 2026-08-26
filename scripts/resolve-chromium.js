#!/usr/bin/env node
/**
 * resolve-chromium.js
 *
 * Finds the Chromium this machine already has, so nothing in this repo decides
 * which browser version the e2e suite runs.
 *
 * Playwright's `browserName: 'chromium'` is an invisible version pin: it
 * resolves to the one revision bundled with the installed @playwright/test, so
 * the browser only moves when someone bumps a devDependency and re-runs
 * `playwright install`. That makes this repo the gate on every Chromium update.
 * The e2e specs load real third-party script into a real page, so they should
 * see the browser our readers actually run, the day their OS updates it, with
 * no commit here.
 *
 * Resolution order:
 *   1. CHROMIUM_PATH, when set -- an explicit escape hatch for any binary.
 *   2. The first system browser found on this platform.
 *   3. undefined -- callers fall back to Playwright's bundled build, so a fresh
 *      clone still works after `npx playwright install chromium`.
 *
 * Usage (CLI, used by CI to skip a download it does not need):
 *   node scripts/resolve-chromium.js    # print the choice; exit 0 when a system
 *                                       # browser was found, 1 when none was
 *
 * Trade-off, stated plainly: Playwright only guarantees the revision it
 * bundles, so a system browser far ahead of it can drift on CDP behaviour.
 * That is the price of not holding updates back, and it fails loudly rather
 * than silently.
 */

'use strict';

const { accessSync, constants } = require('node:fs');

const CANDIDATES = {
  linux: [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/snap/bin/chromium',
  ],
  darwin: [
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ],
};

/**
 * @returns {string|undefined} Path to a system Chromium, or undefined to let
 *   Playwright use its own bundled build.
 */
function resolveChromium() {
  const candidates = process.env.CHROMIUM_PATH
    ? [process.env.CHROMIUM_PATH]
    : (CANDIDATES[process.platform] || []);

  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Not installed here; try the next one.
    }
  }
  return undefined;
}

/**
 * Which binary ran matters the moment a test fails, and the whole point of this
 * module is that the answer changes over time. Say so on every run.
 *
 * @param {string|undefined} path Result of {@link resolveChromium}.
 */
function announceChromium(path) {
  console.log(
    path
      ? `Chromium: ${path} (system)`
      : 'Chromium: bundled with @playwright/test (no system browser found)',
  );
}

module.exports = { resolveChromium, announceChromium };

if (require.main === module) {
  const path = resolveChromium();
  announceChromium(path);
  process.exit(path ? 0 : 1);
}
