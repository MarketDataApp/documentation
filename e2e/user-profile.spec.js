/**
 * Integration tests for the @marketdataapp/ui user-profile component.
 *
 * Verifies: avatar renders when logged in, dropdown opens with expected
 * links, and logout redirects to the dashboard login page.
 *
 * Requires: auth.setup.js to run first (storageState with session cookies).
 */
import { test, expect } from '@playwright/test';

const BASE_URL =
  process.env.TEST_ENV === 'staging'
    ? 'https://www-staging.marketdata.app/docs'
    : 'https://www.marketdata.app/docs';

test.describe('User profile component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  });

  test('user profile avatar is visible when logged in', async ({ page }) => {
    const avatar = page.locator('#avatarButton');
    await expect(avatar).toBeVisible({ timeout: 10_000 });
  });

  test('dropdown opens on avatar click', async ({ page }) => {
    const avatar = page.locator('#avatarButton');
    await expect(avatar).toBeVisible({ timeout: 10_000 });

    await avatar.click();

    const dropdown = page.locator('.user-profile-dropdown');
    await expect(dropdown).toBeVisible();

    // Verify dropdown header shows user info
    await expect(page.locator('.user-profile-dropdown-name')).toBeVisible();
    await expect(page.locator('.user-profile-dropdown-email')).toBeVisible();

    // Verify menu links
    await expect(
      page.locator('.user-profile-dropdown-link', { hasText: 'Dashboard' }),
    ).toBeVisible();
    await expect(
      page.locator('.user-profile-dropdown-link', { hasText: 'Profile' }),
    ).toBeVisible();
    await expect(
      page.locator('.user-profile-dropdown-link', { hasText: 'Modify My Plan' }),
    ).toBeVisible();
    await expect(
      page.locator('.user-profile-dropdown-signout', { hasText: 'Log out' }),
    ).toBeVisible();
  });

  test('dropdown closes on outside click', async ({ page }) => {
    const avatar = page.locator('#avatarButton');
    await expect(avatar).toBeVisible({ timeout: 10_000 });

    await avatar.click();
    const dropdown = page.locator('.user-profile-dropdown');
    await expect(dropdown).toBeVisible();

    // Click outside the dropdown
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await expect(dropdown).not.toBeVisible();
  });

  test('dropdown closes on Escape key', async ({ page }) => {
    const avatar = page.locator('#avatarButton');
    await expect(avatar).toBeVisible({ timeout: 10_000 });

    await avatar.click();
    const dropdown = page.locator('.user-profile-dropdown');
    await expect(dropdown).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dropdown).not.toBeVisible();
  });

  test('logout redirects to dashboard login', async ({ page }) => {
    const avatar = page.locator('#avatarButton');
    await expect(avatar).toBeVisible({ timeout: 10_000 });

    await avatar.click();

    const logoutLink = page.locator('.user-profile-dropdown-signout', {
      hasText: 'Log out',
    });
    await expect(logoutLink).toBeVisible();
    await logoutLink.click();

    // Should redirect to the dashboard login page
    await page.waitForURL(/dashboard\.marketdata\.app/, { timeout: 15_000 });
  });
});
