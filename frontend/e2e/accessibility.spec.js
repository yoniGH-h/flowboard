import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('sign-in page has no automatically detectable WCAG A/AA violations', async ({ page }) => {
  await page.goto('/sign-in');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('authenticated dashboard and administration pages have no detectable WCAG A/AA violations', async ({ page }) => {
  const stamp = Date.now();
  await page.goto('/sign-up');
  await page.getByLabel('Organization name').fill(`Accessible Org ${stamp}`);
  await page.getByLabel('First name').fill('Access');
  await page.getByLabel('Last name').fill('Tester');
  await page.getByLabel('Email address').fill(`accessibility-${stamp}@example.test`);
  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.nth(0).fill('password123');
  await passwordInputs.nth(1).fill('password123');
  await page.getByRole('button', { name: 'Create organization' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  for (const path of ['/dashboard', '/management/projects', '/admin/users', '/profile']) {
    await page.goto(path);
    await page.getByRole('main').waitFor();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations, `Accessibility violations on ${path}`).toEqual([]);
  }
});
