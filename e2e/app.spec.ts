import { test, expect } from '@playwright/test';
import path from 'path';

test('has title', async ({ page }) => {
  const htmlPath = path.join(__dirname, '..', 'build_output', 'index.html');
  await page.goto(`file://${htmlPath}`);

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Barber Booth Pro/);
});
