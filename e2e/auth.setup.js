import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  const pass = process.env.AMEMBER_TEST_PASS;

  if (!pass) {
    throw new Error(
      'AMEMBER_TEST_PASS environment variable is required for authenticated tests',
    );
  }

  await page.goto('https://dashboard.marketdata.app/marketdata/login');
  await page
    .getByRole('textbox', { name: 'Username/Email' })
    .fill('playwright-free');
  await page.getByRole('textbox', { name: 'Password' }).fill(pass);
  await page.getByRole('button', { name: 'Login' }).click();

  // Wait for redirect away from login page
  await page.waitForURL(
    (url) => !url.pathname.includes('/login'),
    { timeout: 15_000 },
  );

  await expect(page).not.toHaveURL(/\/login/);

  // Save session state — cookies are on .marketdata.app so they
  // work across dashboard, www, and www-staging subdomains.
  await page.context().storageState({ path: authFile });
});
