import { test, expect } from '@playwright/test';

// Kanban -> Board settings (the project's manager): add a column with a WIP limit, change a
// limit, and the server refuses to delete a column that still has tasks. Uses a fresh sign-up
// and project in the e2e database.

test('board settings: add a column, set WIP limits, protect columns with tasks', async ({ page }) => {
  const stamp = Date.now();

  await page.goto('/sign-up');
  await page.getByLabel('Organization name').fill(`Board Co ${stamp}`);
  await page.getByLabel('First name').fill('Board');
  await page.getByLabel('Last name').fill('Owner');
  await page.getByLabel('Email address').fill(`board-settings-${stamp}@example.test`);
  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.nth(0).fill('password123');
  await passwordInputs.nth(1).fill('password123');
  await page.getByRole('button', { name: 'Create organization' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/management/projects');
  await page.getByRole('button', { name: 'New Project' }).click();
  const projectName = `Board Settings Project ${stamp}`;
  await page.getByLabel('Project name').fill(projectName);
  await page.getByLabel('Start date').fill(new Date().toISOString().slice(0, 10));
  await page.getByLabel('Target date').fill(new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('cell', { name: projectName, exact: true }).click();
  const projectId = page.url().match(/\/projects\/([^/]+)$/)?.[1];
  await page.goto(`/projects/${projectId}/board`);

  // A task in Backlog, so that column can't be deleted.
  await page.getByRole('button', { name: 'Add Task' }).click();
  await page.getByLabel('Title').fill(`Task ${stamp}`);
  await page.getByRole('button', { name: 'Create task' }).click();
  await expect(page.getByText(`Task ${stamp}`)).toBeVisible();

  await page.getByRole('button', { name: 'Board settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Board settings' });

  // Add a "QA" column with a WIP limit of 2 -> it appears on the board.
  await dialog.getByLabel('New column name').fill('QA');
  await dialog.locator('input').last().fill('2');
  await dialog.getByRole('button', { name: 'Add column' }).click();
  await expect(page.locator('[data-testid="kanban-column-dropzone"][data-column-name="QA"]')).toBeAttached();
  await expect(dialog.getByTestId('board-settings-column')).toHaveCount(6);

  // Change In Progress's WIP limit from 5 to 3.
  const inProgressWip = dialog.getByLabel('WIP limit for In Progress');
  await inProgressWip.fill('3');
  await inProgressWip.blur();
  await expect(page.getByText('WIP 0/3')).toBeAttached();

  // Backlog holds a task -> the server refuses, and the message is shown.
  await dialog.getByRole('button', { name: 'Delete Backlog' }).click();
  await expect(dialog.getByText('Move or archive the tasks in this column before deleting it')).toBeVisible();

  // The empty QA column can be deleted.
  await dialog.getByRole('button', { name: 'Delete QA' }).click();
  await expect(dialog.getByTestId('board-settings-column')).toHaveCount(5);
});
