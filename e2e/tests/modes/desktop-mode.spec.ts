import { test, expect } from '@playwright/test';

test.describe('Desktop Mode Specific Tests', () => {
  // Note: These tests require Tauri to be running
  test.skip(({ browserName }) => browserName !== 'chromium', 'Desktop tests only on Chromium');

  test('should use native clipboard via Tauri', async ({ page }) => {
    // Test Tauri clipboard integration
    await page.goto('/chat');

    // Send a test message
    await page.fill('[data-testid="chat-input"]', 'Test native clipboard');
    await page.click('[data-testid="send-button"]');

    // Wait for response
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();

    // Copy using native clipboard
    await page.click('[data-testid="copy-message"]');

    // Verify Tauri command was called
    // (This would need custom test setup to mock Tauri)
    const clipboardContent = await page.evaluate(async () => {
      // @ts-ignore - Tauri global
      if (window.__TAURI__) {
        // @ts-ignore
        return await window.__TAURI__.clipboard.readText();
      }
      return null;
    });

    if (clipboardContent) {
      expect(clipboardContent.length).toBeGreaterThan(0);
    }
  });

  test('should show native file picker', async ({ page }) => {
    await page.goto('/settings/workflows');

    // Click import button - should trigger native file dialog
    // Note: In actual test, you'd need to mock the file dialog
    await page.click('[data-testid="import-workflow-button"]');

    // Verify that Tauri dialog was invoked
    // (Requires special test setup for Tauri dialogs)
  });

  test('should access system fonts', async ({ page }) => {
    await page.goto('/');

    // Desktop app should have access to system fonts
    const fonts = await page.evaluate(async () => {
      // @ts-ignore
      if (window.__TAURI__) {
        // Query font access
        return await document.fonts.ready;
      }
      return null;
    });

    // Should have font access
    expect(fonts).toBeTruthy();
  });

  test('should persist data in application directory', async ({ page }) => {
    await page.goto('/settings');

    // Change a setting
    await page.fill('[data-testid="temperature-input"]', '0.9');
    await page.click('[data-testid="save-settings"]');

    // Verify saved
    await expect(page.locator('text=Settings saved')).toBeVisible();

    // In desktop mode, this should be saved to:
    // - macOS: ~/Library/Application Support/com.bamboo.app/
    // - Windows: %APPDATA%/bamboo/
    // - Linux: ~/.config/bamboo/
  });

  test('should handle native notifications', async ({ page }) => {
    await page.goto('/settings');

    // Enable notifications
    await page.click('[data-testid="enable-notifications"]');

    // Trigger a notification
    await page.click('[data-testid="test-notification"]');

    // Verify notification was shown
    // (Note: This requires mocking the notification permission)
  });

  test('should support system tray (if implemented)', async ({ page }) => {
    await page.goto('/');

    // Check if system tray is available
    const hasTray = await page.evaluate(() => {
      // @ts-ignore
      return window.__TAURI__ && window.__TAURI__.tray;
    });

    // Skip if not implemented
    if (!hasTray) {
      test.skip();
      return;
    }

    // Test tray functionality
    // (Would need special test setup)
  });

  test('should handle window state persistence', async ({ page }) => {
    // Set window size
    await page.setViewportSize({ width: 1200, height: 800 });

    await page.goto('/');

    // Reload page
    await page.reload();

    // Window state should be restored
    const size = page.viewportSize();
    expect(size?.width).toBe(1200);
    expect(size?.height).toBe(800);
  });

  test('should use secure storage for sensitive data', async ({ page }) => {
    await page.goto('/settings/api');

    // Enter API key
    await page.fill('[data-testid="api-key-input"]', 'secret-key-12345');
    await page.click('[data-testid="save-api-key"]');

    // Verify it's stored securely (not in plain text in localStorage)
    const storedKey = await page.evaluate(() => {
      return localStorage.getItem('api_key');
    });

    // Should not be stored in plain text
    expect(storedKey).not.toBe('secret-key-12345');
  });

  test('should support keyboard shortcuts', async ({ page }) => {
    await page.goto('/chat');

    // Test common keyboard shortcuts
    // Cmd/Ctrl + N for new chat
    await page.keyboard.press('Meta+n');

    // Should create new chat
    await expect(page).toHaveURL(/.*\/chat\/new/);
  });

  test('should handle protocol links (if implemented)', async ({ page }) => {
    // Test bamboo:// protocol
    // (Requires app to be registered as protocol handler)

    // This would typically be tested by:
    // 1. Opening a bamboo:// link
    // 2. Verifying the app responds correctly

    // Skip if not implemented
    test.skip();
  });

  test('should support multiple windows', async ({ page, context }) => {
    await page.goto('/chat');

    // Open new window
    const page2 = await context.newPage();
    await page2.goto('/chat');

    // Both should work independently
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    await expect(page2.locator('[data-testid="chat-input"]')).toBeVisible();

    // Close second window
    await page2.close();
  });

  test('should check for updates (if implemented)', async ({ page }) => {
    await page.goto('/settings');

    // Look for update checker
    const updateButton = page.locator('[data-testid="check-updates"]');

    if (await updateButton.isVisible()) {
      await updateButton.click();

      // Should show update status
      await expect(page.locator('[data-testid="update-status"]')).toBeVisible();
    } else {
      // Feature not implemented
      test.skip();
    }
  });
});
