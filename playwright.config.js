import { defineConfig } from '@playwright/test';

try {
  process.loadEnvFile();
} catch {}

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'smoke',
      testMatch: ['context7-widget.spec.js'],
      use: { browserName: 'chromium' },
    },
  ],
});
