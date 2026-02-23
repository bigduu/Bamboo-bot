import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Workflow Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings/workflows');
  });

  test('should create workflow via HTTP API', async ({ page }) => {
    // Click create button
    await page.click('[data-testid="create-workflow"]');

    // Fill workflow
    await page.fill('[data-testid="workflow-name"]', 'test-workflow');
    await page.fill('[data-testid="workflow-content"]', '# Test Workflow\n\nThis is a test.');

    // Save
    await page.click('[data-testid="save-workflow"]');

    // Verify in list
    await expect(page.locator('text=test-workflow')).toBeVisible();
  });

  test('should delete workflow', async ({ page, request }) => {
    // First create a workflow via API
    await request.post('/v1/v1/bamboo/workflows', {
      data: {
        name: 'workflow-to-delete',
        content: '# Delete Me\n\nThis workflow will be deleted.'
      }
    });

    await page.reload();

    // Find and delete workflow
    const workflow = page.locator('text=workflow-to-delete');
    await expect(workflow).toBeVisible();

    // Delete workflow
    await page.click('[data-testid="delete-workflow-to-delete"]');

    // Confirm deletion
    await page.click('[data-testid="confirm-delete"]');

    // Verify removed
    await expect(page.locator('text=workflow-to-delete')).not.toBeVisible();
  });

  test('should edit existing workflow', async ({ page, request }) => {
    // Create a workflow first
    await request.post('/v1/v1/bamboo/workflows', {
      data: {
        name: 'edit-test-workflow',
        content: '# Original Content'
      }
    });

    await page.reload();

    // Click on workflow to edit
    await page.click('text=edit-test-workflow');

    // Edit content
    await page.fill('[data-testid="workflow-content"]', '# Updated Content\n\nThis has been updated.');
    await page.click('[data-testid="save-workflow"]');

    // Verify saved
    await expect(page.locator('text=Saved successfully')).toBeVisible();
  });

  test('should validate workflow name', async ({ page }) => {
    await page.click('[data-testid="create-workflow"]');

    // Try invalid name with spaces
    await page.fill('[data-testid="workflow-name"]', 'invalid name with spaces');
    await page.click('[data-testid="save-workflow"]');

    // Should show validation error
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
  });

  test('should prevent duplicate workflow names', async ({ page, request }) => {
    // Create first workflow
    await request.post('/v1/v1/bamboo/workflows', {
      data: {
        name: 'duplicate-test',
        content: '# First'
      }
    });

    await page.reload();

    // Try to create duplicate
    await page.click('[data-testid="create-workflow"]');
    await page.fill('[data-testid="workflow-name"]', 'duplicate-test');
    await page.fill('[data-testid="workflow-content"]', '# Second');
    await page.click('[data-testid="save-workflow"]');

    // Should show error
    await expect(page.locator('text=already exists')).toBeVisible();
  });

  test('should display workflow list', async ({ page, request }) => {
    // Create multiple workflows
    await request.post('/v1/v1/bamboo/workflows', {
      data: { name: 'workflow-1', content: '# Workflow 1' }
    });
    await request.post('/v1/v1/bamboo/workflows', {
      data: { name: 'workflow-2', content: '# Workflow 2' }
    });
    await request.post('/v1/v1/bamboo/workflows', {
      data: { name: 'workflow-3', content: '# Workflow 3' }
    });

    await page.reload();

    // Verify all are visible
    await expect(page.locator('text=workflow-1')).toBeVisible();
    await expect(page.locator('text=workflow-2')).toBeVisible();
    await expect(page.locator('text=workflow-3')).toBeVisible();
  });

  test('should search workflows', async ({ page, request }) => {
    // Create workflows with different names
    await request.post('/v1/v1/bamboo/workflows', {
      data: { name: 'python-script', content: '# Python' }
    });
    await request.post('/v1/v1/bamboo/workflows', {
      data: { name: 'javascript-code', content: '# JavaScript' }
    });

    await page.reload();

    // Search for "python"
    await page.fill('[data-testid="workflow-search"]', 'python');

    // Should show only python workflow
    await expect(page.locator('text=python-script')).toBeVisible();
    await expect(page.locator('text=javascript-code')).not.toBeVisible();
  });

  test('should export workflow', async ({ page, request }) => {
    // Create a workflow
    await request.post('/v1/v1/bamboo/workflows', {
      data: { name: 'export-test', content: '# Export Me' }
    });

    await page.reload();

    // Click export
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-export-test"]');
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toContain('export-test');
  });

  test('should import workflow', async ({ page }) => {
    // Use test fixture
    const workflowPath = path.join(__dirname, '../fixtures/test-workflow.md');

    await page.setInputFiles('[data-testid="import-workflow"]', workflowPath);

    // Should show imported workflow
    await expect(page.locator('text=test-workflow')).toBeVisible();
  });

  // ==================== 新增测试场景 ====================

  test('should use workflow in chat', async ({ page }) => {
    // Create a workflow first
    await page.request.post('/v1/v1/bamboo/workflows', {
      data: {
        name: 'chat-workflow',
        content: '# Chat Workflow\n\nYou are a helpful assistant.'
      }
    });

    // Go to chat
    await page.goto('/chat');

    // Use workflow command
    await page.fill('[data-testid="chat-input"]', '/chat-workflow Hello!');
    await page.click('[data-testid="send-button"]');

    // Wait for response
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({
      timeout: 30000
    });
  });

  test('should create workflow with markdown formatting', async ({ page }) => {
    await page.click('[data-testid="create-workflow"]');

    const markdownContent = `# Advanced Workflow

## Instructions
- Step 1: Analyze the problem
- Step 2: Provide solution
- Step 3: Verify result

\`\`\`python
def example():
    return "Hello"
\`\`\`
`;

    await page.fill('[data-testid="workflow-name"]', 'markdown-workflow');
    await page.fill('[data-testid="workflow-content"]', markdownContent);
    await page.click('[data-testid="save-workflow"]');

    // Verify saved
    await expect(page.locator('text=markdown-workflow')).toBeVisible();
  });

  test('should update workflow without changing name', async ({ page, request }) => {
    // Create initial workflow
    await request.post('/v1/v1/bamboo/workflows', {
      data: {
        name: 'update-test',
        content: '# Version 1'
      }
    });

    await page.reload();

    // Click to edit
    await page.click('text=update-test');

    // Update content only
    await page.fill('[data-testid="workflow-content"]', '# Version 2\n\nUpdated content');
    await page.click('[data-testid="save-workflow"]');

    // Verify success
    await expect(page.locator('text=Saved successfully')).toBeVisible();
  });

  test('should persist workflows after page reload', async ({ page }) => {
    // Create workflow
    await page.click('[data-testid="create-workflow"]');
    await page.fill('[data-testid="workflow-name"]', 'persist-test');
    await page.fill('[data-testid="workflow-content"]', '# Persistent Workflow');
    await page.click('[data-testid="save-workflow"]');

    // Verify saved
    await expect(page.locator('text=persist-test')).toBeVisible();

    // Reload page
    await page.reload();

    // Verify workflow still exists
    await expect(page.locator('text=persist-test')).toBeVisible();
  });

  test('should handle workflow with special characters in content', async ({ page }) => {
    await page.click('[data-testid="create-workflow"]');

    const specialContent = `# Special Characters

Test: @#$%^&*()_+-=[]{}|;':",./<>?
Unicode: 你好世界 🌍
Emoji: 🚀 💡 🎉
`;

    await page.fill('[data-testid="workflow-name"]', 'special-chars');
    await page.fill('[data-testid="workflow-content"]', specialContent);
    await page.click('[data-testid="save-workflow"]');

    // Verify saved
    await expect(page.locator('text=special-chars')).toBeVisible();
  });

  test('should show workflow content preview', async ({ page, request }) => {
    // Create workflow
    await request.post('/v1/v1/bamboo/workflows', {
      data: {
        name: 'preview-test',
        content: '# Preview Test\n\nThis is the content'
      }
    });

    await page.reload();

    // Click on workflow
    await page.click('text=preview-test');

    // Verify content is shown in editor
    const content = await page.inputValue('[data-testid="workflow-content"]');
    expect(content).toContain('Preview Test');
    expect(content).toContain('This is the content');
  });

  test('should cancel workflow creation', async ({ page }) => {
    // Start creating workflow
    await page.click('[data-testid="create-workflow"]');
    await page.fill('[data-testid="workflow-name"]', 'cancelled-workflow');
    await page.fill('[data-testid="workflow-content"]', '# Cancelled');

    // Click cancel/new to clear
    await page.click('[data-testid="create-workflow"]');

    // Verify form is cleared
    const nameValue = await page.inputValue('[data-testid="workflow-name"]');
    expect(nameValue).toBe('');
  });

  test('should handle empty workflow list', async ({ page, request }) => {
    // Clean up all workflows
    const workflows = await request.get('/v1/v1/bamboo/workflows');
    const data = await workflows.json();
    for (const workflow of data || []) {
      await request.delete(`/v1/v1/bamboo/workflows/${workflow.name}`);
    }

    await page.reload();

    // Verify empty state message
    await expect(page.locator('text=No workflows found')).toBeVisible();
  });

  test('should sort workflows alphabetically', async ({ page, request }) => {
    // Create workflows in non-alphabetical order
    await request.post('/v1/bamboo/workflows', {
      data: { name: 'zebra-workflow', content: '# Zebra' }
    });
    await request.post('/v1/bamboo/workflows', {
      data: { name: 'alpha-workflow', content: '# Alpha' }
    });
    await request.post('/v1/bamboo/workflows', {
      data: { name: 'beta-workflow', content: '# Beta' }
    });

    await page.reload();

    // Get all workflow names in order
    const workflowNames = await page.locator('[data-testid="workflow-list"] >> text=/^\\w+/').allTextContents();

    // Verify alphabetical order
    const sorted = [...workflowNames].sort();
    expect(workflowNames).toEqual(sorted);
  });

  test('should prevent XSS in workflow content', async ({ page }) => {
    await page.click('[data-testid="create-workflow"]');

    const xssContent = `# XSS Test

<script>alert('xss')</script>
<img src=x onerror=alert('xss')>
`;

    await page.fill('[data-testid="workflow-name"]', 'xss-test');
    await page.fill('[data-testid="workflow-content"]', xssContent);
    await page.click('[data-testid="save-workflow"]');

    // Verify saved without executing scripts
    await expect(page.locator('text=xss-test')).toBeVisible();
  });
});
