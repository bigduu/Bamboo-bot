import { test, expect } from '@playwright/test';

test.describe('Keyword Masking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings/keywords');
  });

  test('should add keyword to mask', async ({ page }) => {
    // Add new keyword
    await page.fill('[data-testid="keyword-input"]', 'secret-key');
    await page.click('[data-testid="add-keyword"]');

    // Verify keyword added
    await expect(page.locator('text=secret-key')).toBeVisible();
  });

  test('should remove keyword from mask list', async ({ page }) => {
    // Add a keyword first
    await page.request.post('/api/v1/bamboo/keywords', {
      data: { keyword: 'remove-me' }
    });

    await page.reload();

    // Remove it
    await page.click('[data-testid="remove-remove-me"]');

    // Verify removed
    await expect(page.locator('text=remove-me')).not.toBeVisible();
  });

  test('should mask keywords in chat responses', async ({ page }) => {
    // Add keyword
    await page.request.post('/api/v1/bamboo/keywords', {
      data: { keyword: 'confidential' }
    });

    // Go to chat
    await page.goto('/chat');

    // Send message that might contain keyword
    await page.fill('[data-testid="chat-input"]', 'Tell me about confidential information');
    await page.click('[data-testid="send-button"]');

    // Wait for response
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();

    // Verify keyword is masked
    const responseText = await page.locator('[data-testid="assistant-message"]').textContent();
    expect(responseText).not.toContain('confidential');
    expect(responseText).toContain('***'); // Or whatever mask character is used
  });

  test('should validate keyword format', async ({ page }) => {
    await page.goto('/settings/keywords');

    // Try empty keyword
    await page.fill('[data-testid="keyword-input"]', '');
    await page.click('[data-testid="add-keyword"]');

    // Should show error
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
  });

  test('should prevent duplicate keywords', async ({ page }) => {
    // Add keyword
    await page.request.post('/api/v1/bamboo/keywords', {
      data: { keyword: 'duplicate' }
    });

    await page.reload();

    // Try to add again
    await page.fill('[data-testid="keyword-input"]', 'duplicate');
    await page.click('[data-testid="add-keyword"]');

    // Should show error
    await expect(page.locator('text=already exists')).toBeVisible();
  });

  test('should mask keywords case-insensitively', async ({ page }) => {
    // Add keyword
    await page.request.post('/api/v1/bamboo/keywords', {
      data: { keyword: 'Secret' }
    });

    await page.goto('/chat');

    // Send message
    await page.fill('[data-testid="chat-input"]', 'Tell me about SECRET things');
    await page.click('[data-testid="send-button"]');

    // Wait for response
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();

    // Verify both cases are masked
    const responseText = await page.locator('[data-testid="assistant-message"]').textContent();
    expect(responseText).not.toContain('SECRET');
    expect(responseText).not.toContain('Secret');
    expect(responseText).not.toContain('secret');
  });

  test('should display keyword list', async ({ page }) => {
    // Add multiple keywords
    await page.request.post('/api/v1/bamboo/keywords', {
      data: { keyword: 'keyword-1' }
    });
    await page.request.post('/api/v1/bamboo/keywords', {
      data: { keyword: 'keyword-2' }
    });
    await page.request.post('/api/v1/bamboo/keywords', {
      data: { keyword: 'keyword-3' }
    });

    await page.goto('/settings/keywords');

    // Verify all visible
    await expect(page.locator('text=keyword-1')).toBeVisible();
    await expect(page.locator('text=keyword-2')).toBeVisible();
    await expect(page.locator('text=keyword-3')).toBeVisible();
  });

  test('should support bulk import of keywords', async ({ page }) => {
    await page.goto('/settings/keywords');

    // Import multiple keywords
    await page.fill('[data-testid="bulk-import"]', 'bulk1,bulk2,bulk3');
    await page.click('[data-testid="import-bulk"]');

    // Verify all imported
    await expect(page.locator('text=bulk1')).toBeVisible();
    await expect(page.locator('text=bulk2')).toBeVisible();
    await expect(page.locator('text=bulk3')).toBeVisible();
  });

  test('should export keyword list', async ({ page }) => {
    // Add some keywords
    await page.request.post('/api/v1/bamboo/keywords', {
      data: { keyword: 'export1' }
    });
    await page.request.post('/api/v1/bamboo/keywords', {
      data: { keyword: 'export2' }
    });

    await page.reload();

    // Export
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-keywords"]');
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toContain('keywords');
  });
});
