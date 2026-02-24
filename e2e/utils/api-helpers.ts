import { APIRequestContext } from '@playwright/test';

/**
 * Setup test configuration via API
 * This marks setup as complete so tests can access /chat and other routes
 */
export async function setupTestConfig(request: APIRequestContext) {
  try {
    // Mark setup as complete
    await markSetupComplete(request);
    console.log('✅ Test setup marked as complete');
  } catch (error) {
    console.log('⚠️  Could not mark setup as complete:', error);
    // This is OK - setup might already be complete
  }
}

/**
 * Clean up test data - workflows and keywords
 */
export async function cleanupTestData(request: APIRequestContext) {
  // Delete test workflows
  try {
    const workflows = await request.get('/v1/bamboo/workflows');
    if (workflows.ok()) {
      const data = await workflows.json();
      for (const workflow of data || []) {
        if (workflow.name && (workflow.name.startsWith('test-') || workflow.name.includes('test'))) {
          await request.delete(`/v1/bamboo/workflows/${encodeURIComponent(workflow.name)}`);
        }
      }
    }
  } catch (e) {
    // Ignore errors during cleanup
  }
}

/**
 * Wait for backend health check
 */
export async function waitForBackendHealth(request: APIRequestContext, maxRetries = 10) {
  let lastStatus: number | undefined;
  let lastBody: string | undefined;
  let lastError: unknown;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await request.get('/api/v1/health');
      lastStatus = response.status();
      const text = await response.text();
      lastBody = text;

      if (response.ok()) {
        // Backend returns "OK" as plain text
        if (text === 'OK' || text === 'ok' || text === 'healthy') {
          return true;
        }
        // Try JSON format as fallback
        try {
          const health = JSON.parse(text);
          if (health.status === 'ok' || health.status === 'healthy') {
            return true;
          }
        } catch {
          // Not JSON, but text was OK
          if (text.toLowerCase().includes('ok')) {
            return true;
          }
        }
      }
    } catch (e) {
      // Continue retrying
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const errMsg = [
    `Backend health check failed after ${maxRetries} retries.`,
    lastStatus !== undefined ? `last_status=${lastStatus}` : null,
    lastBody !== undefined ? `last_body=${JSON.stringify(lastBody.slice(0, 200))}` : null,
    lastError ? `last_error=${(lastError as any)?.message ?? String(lastError)}` : null,
  ].filter(Boolean).join(' ');

  throw new Error(errMsg);
}

/**
 * Create a test workflow
 */
export async function createTestWorkflow(request: APIRequestContext, name: string, content: string) {
  const response = await request.post('/v1/bamboo/workflows', {
    data: {
      name,
      content
    }
  });

  if (!response.ok()) {
    throw new Error(`Failed to create test workflow: ${await response.text()}`);
  }

  return await response.json();
}

/**
 * Delete a test workflow
 */
export async function deleteTestWorkflow(request: APIRequestContext, name: string) {
  const response = await request.delete(`/v1/bamboo/workflows/${encodeURIComponent(name)}`);

  if (!response.ok() && response.status() !== 404) {
    throw new Error(`Failed to delete test workflow: ${await response.text()}`);
  }
}

/**
 * Get setup status
 */
export async function getSetupStatus(request: APIRequestContext) {
  const response = await request.get('/v1/bamboo/setup/status');
  if (!response.ok()) {
    throw new Error(`Failed to get setup status: ${await response.text()}`);
  }
  return await response.json();
}

/**
 * Mark setup as complete
 */
export async function markSetupComplete(request: APIRequestContext) {
  const response = await request.post('/v1/bamboo/setup/complete');
  if (!response.ok()) {
    throw new Error(`Failed to mark setup complete: ${await response.text()}`);
  }
  return await response.json();
}
