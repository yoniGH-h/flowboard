import { test, expect } from '@playwright/test';

// תרחיש ה-Playwright המרכזי: כניסה (דרך הרשמה חדשה,
// כי זו הדרך היחידה ליצור חשבון שלא תלויה בנתוני הדמו) -> פתיחת
// פרויקט -> יצירת משימה -> הזזה שלה בלוח -> הוספת תגובה -> יציאה. רץ
// מול מסד הבדיקות המבודד (ראו playwright.config.js ו-e2e/global-setup.js),
// ואף פעם לא מול נתוני הפיתוח.

async function dragTaskToColumn(page, taskCard, columnName) {
  const target = page.locator(`[data-testid="kanban-column-dropzone"][data-column-name="${columnName}"]`);
  const source = await taskCard.boundingBox();
  const dest = await target.boundingBox();
  if (!source || !dest) throw new Error('Could not measure drag source/target for the kanban drag.');

  const startX = source.x + source.width / 2;
  const startY = source.y + source.height / 2;
  const endX = dest.x + dest.width / 2;
  const endY = dest.y + Math.min(30, dest.height / 2);

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // כמה תזוזות קטנות קודם, כדי לעבור את מרחק ההפעלה של PointerSensor ב-dnd-kit (6 פיקסלים).
  await page.mouse.move(startX + 12, startY + 12, { steps: 5 });
  await page.mouse.move(endX, endY, { steps: 20 });
  await page.mouse.move(endX, endY, { steps: 3 });
  await page.mouse.up();
}

test('golden path: sign up, create a project and task, move it, comment, sign out', async ({ page }) => {
  const stamp = Date.now();
  const email = `golden-path-${stamp}@example.test`;
  const orgName = `Golden Path Co ${stamp}`;
  const taskTitle = `Golden path task ${stamp}`;
  const commentBody = `Looks good - verified at ${stamp}.`;

  await page.goto('/sign-up');
  await page.getByLabel('Organization name').fill(orgName);
  await page.getByLabel('First name').fill('Golden');
  await page.getByLabel('Last name').fill('Pather');
  await page.getByLabel('Email address').fill(email);
  // לא getByLabel('Password', { exact: true }): התווית הצפה של MUI גרמה לכך
  // שהבורר הזה נכשל כאן בזמן קצוב. שני שדות הסיסמה מזוהים בבירור לפי סוג הקלט
  // והסדר בדף (Password ואז Confirm password), ולכן מאתרים אותם כך.
  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.nth(0).fill('password123');
  await passwordInputs.nth(1).fill('password123');
  await page.getByRole('button', { name: 'Create organization' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/management/projects');
  await page.getByRole('button', { name: 'New Project' }).click();
  const projectName = `Golden Path Project ${stamp}`;
  await page.getByLabel('Project name').fill(projectName);
  const today = new Date().toISOString().slice(0, 10);
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel('Start date').fill(today);
  await page.getByLabel('Target date').fill(nextMonth);
  await page.getByRole('button', { name: 'Create project' }).click();

  // exact: true - אחרת זה מתאים גם לכפתור האייקון "Actions for <project name>" בשורה,
  // שהשם הנגיש שלו מכיל את שם הפרויקט.
  const projectCell = page.getByRole('cell', { name: projectName, exact: true });
  await expect(projectCell).toBeVisible();
  await projectCell.click();
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);
  const projectId = page.url().match(/\/projects\/([^/]+)$/)?.[1];
  if (!projectId) throw new Error('Could not read the created project id from the URL.');

  await page.goto(`/projects/${projectId}/board`);
  await page.getByRole('button', { name: 'Add Task' }).click();
  await page.getByLabel('Title').fill(taskTitle);
  await page.getByRole('button', { name: 'Create task' }).click();

  const taskCard = page.getByRole('button', { name: new RegExp(`^Task: ${taskTitle}\\.`) });
  await expect(taskCard).toBeVisible();
  const backlogDropzone = page.locator('[data-testid="kanban-column-dropzone"][data-column-name="Backlog"]');
  await expect(backlogDropzone.getByText(taskTitle)).toBeVisible();

  await dragTaskToColumn(page, taskCard, 'To Do');

  const todoDropzone = page.locator('[data-testid="kanban-column-dropzone"][data-column-name="To Do"]');
  await expect(todoDropzone.getByText(taskTitle)).toBeVisible();

  await taskCard.click();
  await expect(page).toHaveURL(/\/tasks\/[^/]+$/);
  await page.getByPlaceholder('Add a comment…').fill(commentBody);
  await page.getByRole('button', { name: 'Comment' }).click();
  await expect(page.getByText(commentBody)).toBeVisible();

  await page.getByRole('button', { name: 'Open user menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});
