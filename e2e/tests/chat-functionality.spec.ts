import { test, expect } from '@playwright/test';
import { fillReactInput, waitForButtonEnabled } from '../utils/test-helpers';

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app - setup is already completed in global-setup.ts
    await page.goto('/');
  });

  test('should send message and receive response', async ({ page }) => {
    await page.goto('/chat');

    // Wait for input to be ready
    const input = page.locator('[data-testid="chat-input"]');
    await input.waitFor({ state: 'visible', timeout: 10000 });

    // Type message
    await fillReactInput(page, '[data-testid="chat-input"]', 'Hello, AI!');
    await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
    await page.click('[data-testid="send-button"]');

    // Wait for response
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({
      timeout: 30000
    });
  });

  test('should stream response correctly', async ({ page }) => {
    await page.goto('/chat');

    await fillReactInput(page, '[data-testid="chat-input"]', 'Tell me a story');
    await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
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
    await fillReactInput(page, '[data-testid="chat-input"]', 'Test error');
    await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
    await page.click('[data-testid="send-button"]');

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });

  test('should maintain chat history', async ({ page }) => {
    await page.goto('/chat');

    // Send first message
    await fillReactInput(page, '[data-testid="chat-input"]', 'First message');
    await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="assistant-message"]').first()).toBeVisible();

    // Send second message
    await fillReactInput(page, '[data-testid="chat-input"]', 'Second message');
    await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="assistant-message"]').nth(1)).toBeVisible();

    // Verify both messages are visible
    const messages = await page.locator('[data-testid="assistant-message"]').count();
    expect(messages).toBeGreaterThanOrEqual(2);
  });

  test('should allow message cancellation', async ({ page }) => {
    await page.goto('/chat');

    await fillReactInput(page, '[data-testid="chat-input"]', 'Long running request');
    await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
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
    await fillReactInput(page, '[data-testid="chat-input"]', 'Show me a markdown example with code');
    await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
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
    await fillReactInput(page, '[data-testid="chat-input"]', 'Test message');
    await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
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
    await fillReactInput(page, '[data-testid="chat-input"]', 'Give me a random number');
    await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
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

  // ==================== 新增测试场景 ====================

  test('should handle multi-turn conversation', async ({ page }) => {
    await page.goto('/chat');

    // First turn
    await fillReactInput(page, '[data-testid="chat-input"]', 'My name is Alice');
    await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="assistant-message"]').first()).toBeVisible();

    // Second turn - context should be maintained
    await fillReactInput(page, '[data-testid="chat-input"]', 'What is my name?');
    await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="assistant-message"]').nth(1)).toBeVisible();

    // Verify context is maintained
    const secondResponse = await page.locator('[data-testid="assistant-message"]').nth(1).textContent();
    expect(secondResponse?.toLowerCase()).toContain('alice');
  });

  test('should handle long messages', async ({ page }) => {
    await page.goto('/chat');

    const longMessage = 'A'.repeat(1000);
    await fillReactInput(page, '[data-testid="chat-input"]', longMessage);
    await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
    await page.click('[data-testid="send-button"]');

    // Should handle long message without error
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({
      timeout: 30000
    });
  });

  test('should handle special characters in messages', async ({ page }) => {
    await page.goto('/chat');

    const specialMessage = 'Hello! @#$%^&*()_+{}|:<>?~`-=[]\\;\'",./';
    await fillReactInput(page, '[data-testid="chat-input"]', specialMessage);
    await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
    await page.click('[data-testid="send-button"]');

    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({
      timeout: 30000
    });
  });

  test('should handle unicode and emoji', async ({ page }) => {
    await page.goto('/chat');

    const unicodeMessage = 'Hello 世界! 🌍🎉👋';
    await fillReactInput(page, '[data-testid="chat-input"]', unicodeMessage);
    await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
    await page.click('[data-testid="send-button"]');

    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({
      timeout: 30000
    });
  });

  test('should clear input after sending', async ({ page }) => {
    await page.goto('/chat');

    await fillReactInput(page, '[data-testid="chat-input"]', 'This should be cleared');
    await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
    await page.click('[data-testid="send-button"]');

    // Verify input is cleared
    const inputValue = await page.inputValue('[data-testid="chat-input"]');
    expect(inputValue).toBe('');
  });

  test('should disable send button when input is empty', async ({ page }) => {
    await page.goto('/chat');

    // Clear input
    await page.fill('[data-testid="chat-input"]', '');

    // Check if send button is disabled
    const sendButton = page.locator('[data-testid="send-button"]');
    await expect(sendButton).toBeDisabled();
  });

  test('should show user message immediately', async ({ page }) => {
    await page.goto('/chat');

    const userMessage = 'Test user message';
    await fillReactInput(page, '[data-testid="chat-input"]', userMessage);
    await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
    await page.click('[data-testid="send-button"]');

    // Verify user message appears immediately
    await expect(page.locator('[data-testid="user-message"]').filter({ hasText: userMessage })).toBeVisible();
  });

  test('should handle rapid message sending', async ({ page }) => {
    await page.goto('/chat');

    // Send multiple messages rapidly
    for (let i = 0; i < 3; i++) {
      await fillReactInput(page, '[data-testid="chat-input"]', `Message ${i + 1}`);
      await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
      await page.click('[data-testid="send-button"]');
      await page.waitForTimeout(500);
    }

    // Verify all messages are displayed
    const userMessages = await page.locator('[data-testid="user-message"]').count();
    expect(userMessages).toBeGreaterThanOrEqual(3);
  });

  test('should preserve conversation after page reload', async ({ page }) => {
    await page.goto('/chat');

    // Send a message
    await fillReactInput(page, '[data-testid="chat-input"]', 'Remember this: 12345');
    await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();

    // Reload page
    await page.reload();

    // Verify conversation is preserved
    await expect(page.locator('[data-testid="user-message"]').filter({ hasText: 'Remember this: 12345' })).toBeVisible();
  });

  test('should handle code block formatting', async ({ page }) => {
    await page.goto('/chat');

    await fillReactInput(page, '[data-testid="chat-input"]', 'Write a Python function to calculate factorial');
    await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
    await page.click('[data-testid="send-button"]');

    // Wait for response with Python code block
    await expect(page.locator('[data-testid="assistant-message"] pre code')).toBeVisible({
      timeout: 30000
    });

    // Verify code block has proper formatting
    const codeBlock = page.locator('[data-testid="assistant-message"] pre code');
    await expect(codeBlock).toBeVisible();
  });

  test('should show loading state while waiting for response', async ({ page }) => {
    await page.goto('/chat');

    await fillReactInput(page, '[data-testid="chat-input"]', 'Explain quantum computing in detail');
    await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
    await page.click('[data-testid="send-button"]');

    // Should show streaming indicator or loading state
    await expect(page.locator('[data-testid="streaming-indicator"]')).toBeVisible();
  });

  test('should handle conversation branching', async ({ page }) => {
    await page.goto('/chat');

    // Start conversation
    await fillReactInput(page, '[data-testid="chat-input"]', 'Tell me about dogs');
    await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="assistant-message"]').first()).toBeVisible();

    // Continue on same topic
    await fillReactInput(page, '[data-testid="chat-input"]', 'What about cats?');
    await waitForButtonEnabled(page, '[data-testid="send-button"]', 5000);
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="assistant-message"]').nth(1)).toBeVisible();

    // Verify conversation flow
    const messages = await page.locator('[data-testid="assistant-message"]').count();
    expect(messages).toBeGreaterThanOrEqual(2);
  });
});
