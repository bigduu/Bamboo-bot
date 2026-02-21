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

  test('should delete workflow', async ({ page }) => {
    // First create a workflow via API
    await page.request.post('/api/v1/bamboo/workflows', {
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

  test('should edit existing workflow', async ({ page }) => {
    // Create a workflow first
    await page.request.post('/api/v1/bamboo/workflows', {
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

  test('should prevent duplicate workflow names', async ({ page }) => {
    // Create first workflow
    await page.request.post('/api/v1/bamboo/workflows', {
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

  test('should display workflow list', async ({ page }) => {
    // Create multiple workflows
    await page.request.post('/api/v1/bamboo/workflows', {
      data: { name: 'workflow-1', content: '# Workflow 1' }
    });
    await page.request.post('/api/v1/bamboo/workflows', {
      data: { name: 'workflow-2', content: '# Workflow 2' }
    });
    await page.request.post('/api/v1/bamboo/workflows', {
      data: { name: 'workflow-3', content: '# Workflow 3' }
    });

    await page.reload();

    // Verify all are visible
    await expect(page.locator('text=workflow-1')).toBeVisible();
    await expect(page.locator('text=workflow-2')).toBeVisible();
    await expect(page.locator('text=workflow-3')).toBeVisible();
  });

  test('should search workflows', async ({ page }) => {
    // Create workflows with different names
    await page.request.post('/api/v1/bamboo/workflows', {
      data: { name: 'python-script', content: '# Python' }
    });
    await page.request.post('/api/v1/bamboo/workflows', {
      data: { name: 'javascript-code', content: '# JavaScript' }
    });

    await page.reload();

    // Search for "python"
    await page.fill('[data-testid="workflow-search"]', 'python');

    // Should show only python workflow
    await expect(page.locator('text=python-script')).toBeVisible();
    await expect(page.locator('text=javascript-code')).not.toBeVisible();
  });

  test('should export workflow', async ({ page }) => {
    // Create a workflow
    await page.request.post('/api/v1/bamboo/workflows', {
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
});
