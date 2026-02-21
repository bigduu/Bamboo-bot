import { test, expect } from '@playwright/test';

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure setup is complete
    await page.goto('/');
    // ... setup completion logic
  });

  test('should send message and receive response', async ({ page }) => {
    await page.goto('/chat');

    // Type message
    await page.fill('[data-testid="chat-input"]', 'Hello, AI!');
    await page.click('[data-testid="send-button"]');

    // Wait for response
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({
      timeout: 30000
    });
  });

  test('should stream response correctly', async ({ page }) => {
    await page.goto('/chat');

    await page.fill('[data-testid="chat-input"]', 'Tell me a story');
    await page.click('[data-testid="send-button"]');

    // Verify streaming indicators
    await expect(page.locator('[data-testid="streaming-indicator"]')).toBeVisible();

    // Wait for completion
    await expect(page.locator('[data-testid="streaming-indicator"]')).not.toBeVisible({
      timeout: 60000
    });
  });

  test('should handle errors gracefully', async ({ page, context }) => {
    // Simulate network error
    await context.route('**/api/v1/chat', route => route.abort());

    await page.goto('/chat');
    await page.fill('[data-testid="chat-input"]', 'Test error');
    await page.click('[data-testid="send-button"]');

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });

  test('should maintain chat history', async ({ page }) => {
    await page.goto('/chat');

    // Send first message
    await page.fill('[data-testid="chat-input"]', 'First message');
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="assistant-message"]').first()).toBeVisible();

    // Send second message
    await page.fill('[data-testid="chat-input"]', 'Second message');
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="assistant-message"]').nth(1)).toBeVisible();

    // Verify both messages are visible
    const messages = await page.locator('[data-testid="assistant-message"]').count();
    expect(messages).toBeGreaterThanOrEqual(2);
  });

  test('should allow message cancellation', async ({ page }) => {
    await page.goto('/chat');

    await page.fill('[data-testid="chat-input"]', 'Long running request');
    await page.click('[data-testid="send-button"]');

    // Wait for streaming to start
    await expect(page.locator('[data-testid="streaming-indicator"]')).toBeVisible();

    // Cancel the request
    await page.click('[data-testid="cancel-button"]');

    // Verify cancellation
    await expect(page.locator('[data-testid="streaming-indicator"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="cancelled-indicator"]')).toBeVisible();
  });

  test('should support markdown rendering', async ({ page }) => {
    await page.goto('/chat');

    // Request markdown content
    await page.fill('[data-testid="chat-input"]', 'Show me a markdown example with code');
    await page.click('[data-testid="send-button"]');

    // Wait for response with code block
    await expect(page.locator('[data-testid="assistant-message"] pre code')).toBeVisible({
      timeout: 30000
    });
  });

  test('should copy message to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/chat');

    // Send a message
    await page.fill('[data-testid="chat-input"]', 'Test message');
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();

    // Copy the response
    await page.click('[data-testid="copy-message"]');

    // Verify clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBeTruthy();
    expect(clipboardText.length).toBeGreaterThan(0);
  });

  test('should regenerate response', async ({ page }) => {
    await page.goto('/chat');

    // Send initial message
    await page.fill('[data-testid="chat-input"]', 'Give me a random number');
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();

    // Get initial response text
    const initialResponse = await page.locator('[data-testid="assistant-message"]').first().textContent();

    // Regenerate
    await page.click('[data-testid="regenerate-button"]');

    // Wait for new response
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({
      timeout: 30000
    });

    // Verify response changed (or at least regenerated)
    const newResponse = await page.locator('[data-testid="assistant-message"]').first().textContent();
    // Note: responses might be the same, but the action should complete successfully
    expect(newResponse).toBeTruthy();
  });
});
