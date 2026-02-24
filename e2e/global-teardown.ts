import { FullConfig } from '@playwright/test';
import { cleanupTestData } from './utils/api-helpers';

/**
 * Global teardown for E2E tests
 * Runs once after all tests
 */
async function globalTeardown(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  const apiBaseURL = process.env.E2E_API_URL || 'http://localhost:8080';

  console.log('');
  console.log('🧹 Starting E2E teardown...');
  console.log(`   UI Base URL: ${baseURL}`);
  console.log(`   API Base URL: ${apiBaseURL}`);

  try {
    // Create a request context for teardown
    const { request } = require('@playwright/test');
    const apiContext = await request.newContext({
      baseURL: apiBaseURL,
    });

    // Clean up test data
    console.log('🗑️  Cleaning up test data...');
    await cleanupTestData(apiContext);
    console.log('✅ Test data cleaned');

    await apiContext.dispose();
  } catch (error) {
    console.log('⚠️  Could not clean test data during teardown');
    console.log(`   Error: ${error instanceof Error ? error.message : error}`);
  }

  console.log('✅ E2E teardown complete');
}

export default globalTeardown;
