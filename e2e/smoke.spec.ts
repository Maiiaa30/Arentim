import { test, expect } from '@playwright/test';

test('home page loads with brand and disclaimer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /A sorte está/i })).toBeVisible();
  await expect(page.getByText(/Apenas dinheiro de brincadeira/i).first()).toBeVisible();
});

test('logged-out visitors see entrar / criar conta', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Entrar', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar conta' })).toBeVisible();
});

test('protected routes redirect to login when logged out', async ({ page }) => {
  await page.goto('/casino');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: /Bem-vindo de volta/i })).toBeVisible();
});

test('signup page shows the account form', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: /Criar a sua conta/i })).toBeVisible();
  await expect(page.getByLabel('Nome de exibição')).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
});
