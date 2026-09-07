import { defineConfig } from '@playwright/test';
import { announceChromium, resolveChromium } from './scripts/resolve-chromium.js';

try {
  process.loadEnvFile();
} catch {}

// The suite runs against the browser this machine already has, not a revision
// this repo pins through @playwright/test. See scripts/resolve-chromium.js for
// how the browser is chosen and why. Undefined here means no system browser was
// found, and Playwright falls back to its own bundled build.
const CHROMIUM_PATH = resolveChromium();
announceChromium(CHROMIUM_PATH);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    // Inherited by every project below, none of which sets launchOptions itself.
    ...(CHROMIUM_PATH && { launchOptions: { executablePath: CHROMIUM_PATH } }),
  },
  projects: [
    {
      name: 'smoke',
      testMatch: ['context7-widget.spec.js'],
      use: { browserName: 'chromium' },
    },
    {
      name: 'markdown-actions',
      testMatch: ['markdown-actions.spec.js'],
      use: { browserName: 'chromium' },
    },
    {
      // Sets its own viewport per test, so it takes no `use.viewport` here.
      name: 'responsive',
      testMatch: ['responsive.spec.js'],
      use: { browserName: 'chromium' },
    },
  ],
});
