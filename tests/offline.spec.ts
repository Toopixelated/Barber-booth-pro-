import { test, expect } from '@playwright/test';

test.describe('Offline Functionality', () => {
  test('should load the application when offline', async ({ page, context }) => {
    // First, visit the page to allow the service worker to cache assets.
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Now, go offline.
    await context.setOffline(true);

    // Reload the page.
    await page.reload();

    // Verify that the app still loads by checking for the title.
    await expect(page).toHaveTitle(/Barber Booth Pro/);

    // You can also check for a specific element that should be visible.
    await expect(page.getByText('Upload Your Photo')).toBeVisible();
  });
});
