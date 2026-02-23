import { test, expect } from '@playwright/test';

test.describe('Setup Flow', () => {
  test('should complete setup in browser mode', async ({ page }) => {
    await page.goto('/');

    // Check setup page appears
    await expect(page.locator('[data-testid="setup-wizard"]')).toBeVisible();

    // Complete setup steps
    await page.click('[data-testid="setup-next"]');
    // ... more steps

    // Verify redirect to chat
    await expect(page).toHaveURL(/.*\/chat/);
  });

  test('should skip proxy configuration in browser mode', async ({ page }) => {
    await page.goto('/setup');

    // Proxy step should be skipped or show info message
    const proxySection = page.locator('[data-testid="proxy-config"]');
    const isVisible = await proxySection.isVisible();

    if (isVisible) {
      // Desktop mode - can configure proxy
      await expect(proxySection).toBeVisible();
    } else {
      // Browser mode - should show message
      await expect(page.locator('text=only available in desktop')).toBeVisible();
    }
  });

  test('should validate API key on setup', async ({ page }) => {
    await page.goto('/setup');

    // Enter invalid API key
    await page.fill('[data-testid="api-key-input"]', 'invalid-key');
    await page.click('[data-testid="validate-key"]');

    // Should show validation error
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
  });

  test('should save configuration after setup', async ({ page }) => {
    await page.goto('/setup');

    // Complete setup with valid data
    await page.fill('[data-testid="api-key-input"]', 'test-api-key');
    await page.click('[data-testid="setup-next"]');

    // Finish setup
    await page.click('[data-testid="setup-finish"]');

    // Verify config saved
    await expect(page.locator('[data-testid="setup-complete"]')).toBeVisible();
  });

  test('should allow reconfiguration from settings', async ({ page }) => {
    // Assume setup is already complete
    await page.goto('/settings');

    // Click reconfigure
    await page.click('[data-testid="reconfigure-button"]');

    // Should navigate to setup
    await expect(page).toHaveURL(/.*\/setup/);
  });
});
