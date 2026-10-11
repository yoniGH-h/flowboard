import { test, expect } from '@playwright/test';

// פרופיל -> שינוי סיסמה, מקצה לקצה: סיסמה נוכחית שגויה נדחית,
// שינוי תקין עובד, ואחריו רק הסיסמה החדשה מכניסה. משתמש בהרשמה חדשה
// במסד הבדיקות, כך שלא נוגעים בסיסמה של אף חשבון דמו.

async function signIn(page, email, password) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test('change password from the profile page', async ({ page }) => {
  const stamp = Date.now();
  const email = `change-password-${stamp}@example.test`;

  await page.goto('/sign-up');
  await page.getByLabel('Organization name').fill(`Password Co ${stamp}`);
  await page.getByLabel('First name').fill('Pass');
  await page.getByLabel('Last name').fill('Word');
  await page.getByLabel('Email address').fill(email);
  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.nth(0).fill('password123');
  await passwordInputs.nth(1).fill('password123');
  await page.getByRole('button', { name: 'Create organization' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/profile');
  const current = page.getByLabel('Current password');
  const next = page.getByLabel('New password');

  // סיסמה נוכחית שגויה -> ההודעה של השרת מוצגת, ושום דבר לא משתנה.
  await current.fill('not-my-password');
  await next.fill('BrandNew456');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByText('Current password is incorrect')).toBeVisible();

  // סיסמה נוכחית נכונה -> הסיסמה שונתה.
  await current.fill('password123');
  await next.fill('BrandNew456');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByText('Your password has been changed')).toBeVisible();

  await page.getByRole('button', { name: 'Open user menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  // הסיסמה הישנה כבר לא עובדת; החדשה עובדת.
  await signIn(page, email, 'password123');
  await expect(page.getByText('Invalid email or password')).toBeVisible();
  await signIn(page, email, 'BrandNew456');
  // אחרי הכניסה: האתר חוזר לעמוד שבו המשתמש היה לפני היציאה.
  await expect(page).toHaveURL(/\/profile$/);
});
