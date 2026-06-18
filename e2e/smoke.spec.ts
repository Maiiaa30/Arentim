import { test, expect } from '@playwright/test';

test('home page loads with brand and disclaimer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Welcome to Arentim/i })).toBeVisible();
  await expect(page.getByText(/Play money only/i).first()).toBeVisible();
});

test('primary navigation reaches the casino route', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Casino' }).first().click();
  await expect(page).toHaveURL(/\/casino$/);
  await expect(page.getByRole('heading', { name: 'Casino' })).toBeVisible();
});
