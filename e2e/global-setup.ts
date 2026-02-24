import { FullConfig } from '@playwright/test';
import { waitForBackendHealth, cleanupTestData, setupTestConfig } from './utils/api-helpers';

/**
 * Global setup for E2E tests
 * Runs once before all tests
 */
async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  // Prefer 127.0.0.1 to avoid IPv6 localhost (::1) issues with Docker port publishing in CI.
  const apiBaseURL = process.env.E2E_API_URL || 'http://127.0.0.1:8080';

  console.log('🚀 Starting E2E test setup...');
  console.log(`   UI Base URL: ${baseURL}`);
  console.log(`   API Base URL: ${apiBaseURL}`);

  // Check if backend is running
  try {
    // Create a request context for setup
    const { request } = require('@playwright/test');
    const apiContext = await request.newContext({
      baseURL: apiBaseURL,
    });

    console.log('⏳ Checking backend health...');
    await waitForBackendHealth(apiContext, 30);
    console.log('✅ Backend is healthy');

    // Mark setup as complete so tests can access /chat and other routes
    console.log('🔧 Marking setup as complete...');
    try {
      await setupTestConfig(apiContext);
      console.log('✅ Setup marked as complete');
    } catch (e) {
      console.log('⚠️  Could not mark setup as complete (this is OK if already complete)');
      console.log(`   Error: ${e instanceof Error ? e.message : e}`);
    }

    // Clean up any existing test data
    console.log('🧹 Cleaning up test data...');
    try {
      await cleanupTestData(apiContext);
      console.log('✅ Test data cleaned');
    } catch (e) {
      console.log('⚠️  Could not clean test data (this is OK for first run)');
    }

    await apiContext.dispose();
  } catch (error) {
    console.error('❌ Backend health check failed');
    console.error(`   Error: ${error instanceof Error ? error.message : error}`);
    console.error('');
    console.error('Please ensure the backend is running:');
    console.error('   cargo run -p web_service_standalone -- serve --port 8080 --data-dir /tmp/test-data');
    console.error('');
    console.error('Or start it automatically:');
    console.error('   E2E_START_SERVER="cargo run -p web_service_standalone -- serve --port 8080 --data-dir /tmp/test-data" yarn test:e2e');
    process.exit(1);
  }

  console.log('✅ E2E setup complete');
  console.log('');
}

export default globalSetup;
