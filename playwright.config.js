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
    {
      name: 'auth-setup',
      testMatch: ['auth.setup.js'],
      use: { browserName: 'chromium' },
    },
    {
      name: 'user-profile',
      testMatch: ['user-profile.spec.js'],
      dependencies: ['auth-setup'],
      use: {
        browserName: 'chromium',
        storageState: 'e2e/.auth/user.json',
      },
    },
  ],
});
