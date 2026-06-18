import { test, expect } from '@playwright/test';

test('home page loads with brand and disclaimer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Welcome to Arentim/i })).toBeVisible();
  await expect(page.getByText(/Play money only/i).first()).toBeVisible();
});

test('logged-out visitors see sign in / sign up', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign up' })).toBeVisible();
});

test('protected routes redirect to login when logged out', async ({ page }) => {
  await page.goto('/casino');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
});

test('signup page shows the account form', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: /Create your account/i })).toBeVisible();
  await expect(page.getByLabel('Display name')).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
});
