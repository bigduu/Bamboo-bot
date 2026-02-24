import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Bodhi E2E tests
 *
 * Usage:
 * - Browser mode: E2E_BASE_URL=http://localhost:1420 yarn test:e2e
 * - Docker mode: E2E_BASE_URL=http://localhost:8080 yarn test:e2e
 * - With server auto-start: E2E_START_SERVER="cargo run -p web_service_standalone -- --port 8080" yarn test:e2e
 */

const suite = process.env.E2E_SUITE ?? 'all';
const testIgnore: string[] = [];

if (suite === 'browser') {
  testIgnore.push('tests/docker/**', 'tests/modes/docker-mode.spec.ts', 'tests/modes/desktop-mode.spec.ts');
}
if (suite === 'docker') {
  testIgnore.push('tests/modes/browser-mode.spec.ts', 'tests/modes/desktop-mode.spec.ts');
}

export default defineConfig({
  testDir: './tests',
  testIgnore,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Increase timeouts for CI/slower environments
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to test other browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
  // Only use webServer if E2E_START_SERVER is set
  ...(process.env.E2E_START_SERVER ? {
    webServer: {
      command: process.env.E2E_START_SERVER,
      cwd: '..', // Run from project root so ./dist resolves correctly
      url: 'http://localhost:8080/api/v1/health',
      reuseExistingServer: false,
      timeout: 120000,
    },
  } : {}),
  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),
});
