import { test, expect } from '@playwright/test';

test.describe('Browser Mode Specific Tests', () => {
  test.use({ baseURL: 'http://localhost:1420' }); // Vite dev server

  test('should connect to backend on port 8080', async ({ page }) => {
    await page.goto('/');

    // Check backend health
    const healthResponse = await page.request.get('http://localhost:8080/api/v1/health');
    expect(healthResponse.ok()).toBeTruthy();
  });

  test('should use Web Clipboard API', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/chat');

    // Send a test message
    await page.fill('[data-testid="chat-input"]', 'Test clipboard');
    await page.click('[data-testid="send-button"]');

    // Wait for response
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();

    // Copy text
    await page.click('[data-testid="copy-message"]');

    // Verify clipboard
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBeTruthy();
    expect(clipboardText.length).toBeGreaterThan(0);
  });

  test('should show graceful fallback for desktop-only features', async ({ page }) => {
    await page.goto('/settings');

    // Check for desktop-only feature notice
    const desktopOnlyFeatures = page.locator('[data-testid="desktop-only-notice"]');

    if (await desktopOnlyFeatures.count() > 0) {
      await expect(desktopOnlyFeatures.first()).toContainText('desktop application');
    }
  });

  test('should handle WebSocket connection', async ({ page }) => {
    await page.goto('/chat');

    // Wait for WebSocket to connect
    await page.waitForFunction(() => {
      // Check for WebSocket connection indicator
      const indicator = document.querySelector('[data-testid="connection-status"]');
      return indicator && indicator.textContent?.includes('connected');
    }, { timeout: 10000 });
  });

  test('should reconnect on WebSocket disconnect', async ({ page, context }) => {
    await page.goto('/chat');

    // Wait for initial connection
    await page.waitForFunction(() => {
      const indicator = document.querySelector('[data-testid="connection-status"]');
      return indicator && indicator.textContent?.includes('connected');
    }, { timeout: 10000 });

    // Simulate network issue by going offline
    await context.setOffline(true);
    await page.waitForTimeout(1000);

    // Come back online
    await context.setOffline(false);

    // Should reconnect automatically
    await page.waitForFunction(() => {
      const indicator = document.querySelector('[data-testid="connection-status"]');
      return indicator && indicator.textContent?.includes('connected');
    }, { timeout: 15000 });
  });

  test('should work in different browsers', async ({ page, browserName }) => {
    await page.goto('/');

    // Basic functionality should work in all browsers
    await expect(page.locator('body')).toBeVisible();

    // Test in chat
    await page.goto('/chat');
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
  });

  test('should store data in localStorage', async ({ page }) => {
    await page.goto('/');

    // Set some data
    await page.evaluate(() => {
      localStorage.setItem('test-key', 'test-value');
    });

    // Verify it persists
    const value = await page.evaluate(() => {
      return localStorage.getItem('test-key');
    });

    expect(value).toBe('test-value');
  });

  test('should handle session storage', async ({ page }) => {
    await page.goto('/');

    // Store session data
    await page.evaluate(() => {
      sessionStorage.setItem('session-test', 'session-value');
    });

    // Verify it exists
    const value = await page.evaluate(() => {
      return sessionStorage.getItem('session-test');
    });

    expect(value).toBe('session-value');
  });

  test('should support responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Should adapt to mobile
    await expect(page.locator('body')).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.reload();

    // Should work on desktop too
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle CORS properly', async ({ page }) => {
    // Make request from different origin
    const response = await page.request.get('http://localhost:8080/api/v1/health');

    // Should have CORS headers
    const corsHeader = response.headers()['access-control-allow-origin'];
    expect(corsHeader).toBeTruthy();
  });

  test('should show proper error for missing backend', async ({ page, context }) => {
    // Block backend requests
    await context.route('**/localhost:8080/**', route => route.abort());

    await page.goto('/');

    // Should show connection error
    await expect(page.locator('[data-testid="connection-error"]')).toBeVisible({
      timeout: 10000
    });
  });

  test('should work without service worker', async ({ page }) => {
    // Service worker is optional for browser mode
    await page.goto('/');

    // App should still work
    await expect(page.locator('body')).toBeVisible();

    // Navigate to chat
    await page.goto('/chat');
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
  });
});
