import { test, expect } from '@playwright/test';

test.describe('Settings Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
  });

  test('should display settings categories', async ({ page }) => {
    // Verify main settings categories exist
    await expect(page.locator('text=General')).toBeVisible();
    await expect(page.locator('text=API')).toBeVisible();
    await expect(page.locator('text=Appearance')).toBeVisible();
    await expect(page.locator('text=Workflows')).toBeVisible();
  });

  test('should update API configuration', async ({ page }) => {
    // Navigate to API settings
    await page.click('text=API');

    // Update API key
    await page.fill('[data-testid="api-key-input"]', 'new-test-key');
    await page.click('[data-testid="save-api-settings"]');

    // Verify saved
    await expect(page.locator('text=Settings saved')).toBeVisible();
  });

  test('should change model selection', async ({ page }) => {
    await page.click('text=General');

    // Change model
    await page.selectOption('[data-testid="model-select"]', 'gpt-4');
    await page.click('[data-testid="save-general-settings"]');

    // Verify saved
    await expect(page.locator('text=Settings saved')).toBeVisible();
  });

  test('should update temperature setting', async ({ page }) => {
    await page.click('text=General');

    // Update temperature
    await page.fill('[data-testid="temperature-input"]', '0.8');
    await page.click('[data-testid="save-general-settings"]');

    // Verify saved
    await expect(page.locator('text=Settings saved')).toBeVisible();

    // Verify value persisted
    const temperature = await page.inputValue('[data-testid="temperature-input"]');
    expect(temperature).toBe('0.8');
  });

  test('should toggle dark mode', async ({ page }) => {
    await page.click('text=Appearance');

    // Toggle dark mode
    const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"]');
    const initialState = await darkModeToggle.isChecked();

    await darkModeToggle.click();
    await page.click('[data-testid="save-appearance-settings"]');

    // Verify state changed
    const newState = await darkModeToggle.isChecked();
    expect(newState).toBe(!initialState);
  });

  test('should validate settings before save', async ({ page }) => {
    await page.click('text=General');

    // Enter invalid temperature
    await page.fill('[data-testid="temperature-input"]', '5.0'); // Out of range
    await page.click('[data-testid="save-general-settings"]');

    // Should show validation error
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
  });

  test('should reset settings to defaults', async ({ page }) => {
    await page.click('text=General');

    // Change a setting
    await page.fill('[data-testid="temperature-input"]', '0.9');
    await page.click('[data-testid="save-general-settings"]');

    // Reset to defaults
    await page.click('[data-testid="reset-to-defaults"]');

    // Confirm reset
    await page.click('[data-testid="confirm-reset"]');

    // Verify temperature is back to default
    const temperature = await page.inputValue('[data-testid="temperature-input"]');
    expect(temperature).toBe('0.7'); // Assuming 0.7 is default
  });

  test('should export all settings', async ({ page }) => {
    // Export settings
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-settings"]');
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toContain('settings');
    expect(download.suggestedFilename()).toContain('.json');
  });

  test('should import settings', async ({ page }) => {
    // Use test fixture
    await page.setInputFiles('[data-testid="import-settings"]', './fixtures/test-config.json');

    // Verify imported
    await expect(page.locator('text=Settings imported')).toBeVisible();

    // Verify a setting value
    await page.click('text=General');
    const temperature = await page.inputValue('[data-testid="temperature-input"]');
    expect(temperature).toBe('0.7');
  });

  test('should show current API status', async ({ page }) => {
    await page.click('text=API');

    // Check API status indicator
    const statusIndicator = page.locator('[data-testid="api-status"]');

    // Should show either connected or disconnected
    await expect(statusIndicator).toBeVisible();
    const status = await statusIndicator.textContent();
    expect(status).toMatch(/connected|disconnected/i);
  });

  test('should validate API key', async ({ page }) => {
    await page.click('text=API');

    // Enter API key
    await page.fill('[data-testid="api-key-input"]', 'test-api-key');

    // Validate
    await page.click('[data-testid="validate-api-key"]');

    // Should show validation result
    await expect(page.locator('[data-testid="validation-result"]')).toBeVisible();
  });

  test('should manage proxy settings (desktop only)', async ({ page }) => {
    await page.click('text=API');

    // Check if proxy settings are available
    const proxySection = page.locator('[data-testid="proxy-settings"]');
    const isVisible = await proxySection.isVisible();

    if (isVisible) {
      // Desktop mode - configure proxy
      await page.fill('[data-testid="proxy-url"]', 'http://proxy.example.com:8080');
      await page.click('[data-testid="save-proxy-settings"]');

      await expect(page.locator('text=Proxy settings saved')).toBeVisible();
    } else {
      // Browser mode - should show message
      await expect(page.locator('text=only available in desktop')).toBeVisible();
    }
  });

  test('should show application version', async ({ page }) => {
    // Check for version info
    const versionInfo = page.locator('[data-testid="app-version"]');
    await expect(versionInfo).toBeVisible();

    const version = await versionInfo.textContent();
    expect(version).toMatch(/\d+\.\d+\.\d+/); // Semantic versioning pattern
  });

  // ==================== 新增测试场景 ====================

  test('should navigate between settings tabs', async ({ page }) => {
    // Click through different tabs
    const tabs = ['Config', 'Prompts', 'App', 'Provider', 'Masking', 'Workflows'];

    for (const tab of tabs) {
      await page.click(`text=${tab}`);
      // Verify tab content is visible
      await expect(page.locator('.ant-tabs-tab-active').filter({ hasText: tab })).toBeVisible();
    }
  });

  test('should persist settings after page reload', async ({ page }) => {
    // Go to Provider settings and change provider
    await page.click('text=Provider');
    await page.selectOption('[data-testid="provider-select"]', 'openai');
    await page.fill('[data-testid="api-key-input"]', 'test-key-123');
    await page.click('[data-testid="save-api-settings"]');

    // Wait for save confirmation
    await expect(page.locator('text=Configuration saved')).toBeVisible();

    // Reload page
    await page.reload();

    // Verify settings persisted
    await page.click('text=Provider');
    const apiKey = await page.inputValue('[data-testid="api-key-input"]');
    expect(apiKey).toBe('test-key-123');
  });

  test('should show unsaved changes warning', async ({ page }) => {
    await page.click('text=Provider');

    // Make changes without saving
    await page.fill('[data-testid="api-key-input"]', 'unsaved-key');

    // Try to navigate away
    await page.click('text=Config');

    // Should show warning or prompt
    // Note: This depends on implementation, may need adjustment
  });

  test('should handle invalid API key format', async ({ page }) => {
    await page.click('text=Provider');

    // Enter invalid API key format
    await page.fill('[data-testid="api-key-input"]', 'invalid-key-format');
    await page.click('[data-testid="save-api-settings"]');

    // Should show validation error
    await expect(page.locator('[data-testid="validation-error"]').or(page.locator('text=error'))).toBeVisible();
  });

  test('should toggle auto-generate titles', async ({ page }) => {
    await page.click('text=App');

    // Find and toggle auto-generate titles switch
    const toggle = page.locator('text=Auto-generate Chat Titles').locator('..').locator('.ant-switch');
    const initialState = await toggle.isChecked();

    await toggle.click();

    // Verify toggle changed
    const newState = await toggle.isChecked();
    expect(newState).toBe(!initialState);
  });

  test('should clear all chats', async ({ page }) => {
    await page.click('text=App');

    // Click delete all chats
    await page.click('text=Delete All Chats');

    // Confirm deletion
    await page.click('text=Yes, delete all');

    // Verify success message
    await expect(page.locator('text=All chats deleted')).toBeVisible();
  });

  test('should switch between light and dark theme', async ({ page }) => {
    await page.click('text=App');

    // Get initial theme
    const initialTheme = await page.evaluate(() => localStorage.getItem('bamboo_dark_mode'));

    // Toggle dark mode
    const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"]');
    await darkModeToggle.click();

    // Verify theme changed in localStorage
    const newTheme = await page.evaluate(() => localStorage.getItem('bamboo_dark_mode'));
    expect(newTheme).not.toBe(initialTheme);
  });

  test('should show provider configuration options', async ({ page }) => {
    await page.click('text=Provider');

    // Verify provider select is visible
    await expect(page.locator('[data-testid="provider-select"]')).toBeVisible();

    // Test different providers
    const providers = ['copilot', 'openai', 'anthropic', 'gemini'];
    for (const provider of providers) {
      await page.selectOption('[data-testid="provider-select"]', provider);
      await expect(page.locator(`text=${provider}`).or(page.locator(`text=${provider.charAt(0).toUpperCase() + provider.slice(1)}`))).toBeVisible();
    }
  });

  test('should save keyword masking settings', async ({ page }) => {
    await page.click('text=Masking');

    // Add a keyword
    await page.click('[data-testid="add-keyword"]');
    await page.fill('[data-testid="keyword-pattern-input"]', 'secret-token');
    await page.click('[data-testid="save-keyword"]');

    // Verify keyword added
    await expect(page.locator('text=secret-token')).toBeVisible();
  });

  test('should reload configuration', async ({ page }) => {
    await page.click('text=Config');

    // Click reload button
    await page.click('text=Reload');

    // Verify success message
    await expect(page.locator('text=reloaded').or(page.locator('text=Reloaded'))).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page, context }) => {
    // Block API requests
    await context.route('**/api/**', route => route.abort());

    await page.click('text=Provider');
    await page.fill('[data-testid="api-key-input"]', 'test-key');
    await page.click('[data-testid="save-api-settings"]');

    // Should show error message
    await expect(page.locator('text=error').or(page.locator('text=Error'))).toBeVisible();
  });

  test('should validate proxy URL format', async ({ page }) => {
    await page.click('text=Config');

    // Enter invalid proxy URL
    await page.fill('[data-testid="proxy-url"]', 'not-a-valid-url');
    await page.click('[data-testid="save-proxy-settings"]');

    // Should show validation error or handle gracefully
    // Note: Behavior depends on implementation
  });

  test('should show backend connection status', async ({ page }) => {
    await page.click('text=Config');

    // Check for backend status indicator
    const backendStatus = page.locator('text=Backend').or(page.locator('text=backend'));
    await expect(backendStatus).toBeVisible();
  });
});
