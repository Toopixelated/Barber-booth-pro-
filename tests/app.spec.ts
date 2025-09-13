import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES-module friendly way to get __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Barber Booth Pro - Diagnostic Tests', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'test-image.jpg');

  test('should upload an image and display it in the main view', async ({ page }) => {
    // 1. Navigate to the app
    await page.goto('/');

    // 2. Upload an image
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload Photo' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(fixturePath);

    // 3. Save from the editor
    await page.getByRole('button', { name: 'Save' }).click();

    // 4. Verify the uploaded image is now visible in the main UI.
    // We check for the 'Change Photo' button which appears after a successful upload.
    // Using a short timeout to fail fast if there's an issue.
    await expect(page.getByRole('button', { name: 'Change Photo' })).toBeVisible({ timeout: 15000 });
  });
});
