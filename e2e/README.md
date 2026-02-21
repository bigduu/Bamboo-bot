# E2E Testing

End-to-end testing infrastructure for Bamboo using Playwright.

## Setup

1. Install dependencies:
   ```bash
   cd e2e
   yarn install
   npx playwright install
   ```

2. Set up environment:
   ```bash
   cp .env.test.example .env.test
   # Edit .env.test with your configuration
   ```

## Running Tests

### Browser Mode
Requires backend + frontend running separately:
```bash
# Terminal 1: Start backend
cargo run -p web_service_standalone -- --port 8080 --data-dir /tmp/test-data

# Terminal 2: Start frontend
yarn dev

# Terminal 3: Run tests
yarn test:e2e:browser
```

### Docker Mode
Test the integrated Docker container:
```bash
# Build and run Docker container
cd docker
docker-compose up -d

# Run tests
yarn test:e2e:docker
```

### Desktop Mode
Test the Tauri desktop application:
```bash
# Start Tauri app
yarn tauri dev

# Run tests (in another terminal)
yarn test:e2e
```

## Test Structure

```
e2e/
├── tests/
│   ├── setup-flow.spec.ts        # Setup wizard tests
│   ├── chat-functionality.spec.ts # Chat operations
│   ├── workflows.spec.ts         # Workflow management
│   ├── keyword-masking.spec.ts   # Keyword masking
│   ├── settings.spec.ts          # Settings management
│   └── modes/
│       ├── browser-mode.spec.ts  # Browser-specific tests
│       ├── desktop-mode.spec.ts  # Desktop-only features
│       └── docker-mode.spec.ts   # Docker deployment tests
├── fixtures/
│   ├── test-workflow.md          # Sample workflow file
│   └── test-config.json          # Test configuration
├── utils/
│   ├── api-helpers.ts            # API utilities
│   └── test-helpers.ts           # Test utilities
└── playwright.config.ts          # Playwright configuration
```

## Test Categories

### Setup Flow Tests
- Initial setup wizard
- API key validation
- Configuration persistence

### Chat Functionality Tests
- Message sending/receiving
- Response streaming
- Error handling
- Chat history management
- Message operations (copy, regenerate, cancel)

### Workflow Tests
- Create/edit/delete workflows
- Workflow validation
- Import/export workflows
- Search functionality

### Keyword Masking Tests
- Add/remove keywords
- Masking in responses
- Case-insensitive masking
- Bulk operations

### Settings Tests
- Configuration management
- Theme settings
- API configuration
- Import/export settings

### Mode-Specific Tests

#### Browser Mode
- Web Clipboard API
- CORS handling
- WebSocket connections
- Graceful fallbacks for desktop features

#### Desktop Mode
- Native clipboard (Tauri)
- Native file picker
- System tray (if implemented)
- Secure storage
- Window state persistence

#### Docker Mode
- Static file serving
- SPA routing
- Proxy configuration
- Health checks
- Performance under load

## Debugging

### UI Mode
Interactive test runner with time-travel debugging:
```bash
yarn test:e2e:ui
```

### Debug Mode
Step through tests with Playwright Inspector:
```bash
yarn test:e2e:debug
```

### View Report
After tests run, view the HTML report:
```bash
yarn test:e2e:report
```

### Screenshots
Failed tests automatically capture screenshots in `test-results/`

### Traces
First retry captures trace files that can be viewed in:
```bash
npx playwright show-trace trace.zip
```

## Writing Tests

### Basic Test Structure
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup
  });

  test('should do something', async ({ page }) => {
    // Arrange
    await page.goto('/');

    // Act
    await page.click('[data-testid="button"]');

    // Assert
    await expect(page.locator('[data-testid="result"]')).toBeVisible();
  });
});
```

### Using Test Helpers
```typescript
import { completeSetupIfNeeded, waitForToast } from '../utils/test-helpers';

test('example with helpers', async ({ page }) => {
  await completeSetupIfNeeded(page);
  await page.fill('[data-testid="input"]', 'test');
  await page.click('[data-testid="submit"]');
  await waitForToast(page, 'Success');
});
```

### Using API Helpers
```typescript
import { createTestWorkflow, cleanupTestData } from '../utils/api-helpers';

test.beforeEach(async ({ request }) => {
  await createTestWorkflow(request, 'test-workflow', '# Test');
});

test.afterEach(async ({ request }) => {
  await cleanupTestData(request);
});
```

### Mocking API Responses
```typescript
import { mockApiError, mockApiResponse } from '../utils/test-helpers';

test('handles API error', async ({ page }) => {
  await mockApiError(page, 'chat', 500);
  await page.goto('/chat');
  // Test error handling
});
```

## Best Practices

1. **Use data-testid attributes** for reliable selectors
2. **Wait for network idle** when loading pages
3. **Clean up test data** in afterEach hooks
4. **Use API helpers** for setup/teardown
5. **Test accessibility** with checkAccessibility helper
6. **Measure performance** for critical paths
7. **Take screenshots** on failure for debugging
8. **Use retries** for flaky operations

## CI Integration

Tests run automatically in GitHub Actions:

- **Browser Mode**: Runs on every PR and push to main
- **Docker Mode**: Runs on every PR and push to main
- **Desktop Mode**: Manual trigger (requires special setup)

See `.github/workflows/e2e-tests.yml` for configuration.

## Troubleshooting

### Tests fail with timeout
- Increase timeout in playwright.config.ts
- Check if backend is running
- Verify network connectivity

### Flaky tests
- Use `waitForLoadState('networkidle')`
- Add explicit waits for elements
- Check for race conditions

### Clipboard tests fail
- Grant clipboard permissions: `await context.grantPermissions(['clipboard-read'])`
- Check browser compatibility

### File upload tests fail
- Verify file paths are correct
- Check file permissions
- Use setInputFiles for file inputs

### Desktop mode tests fail
- Ensure Tauri is running
- Check if desktop app is accessible
- Verify Chromium is used (not Firefox/WebKit)

## Coverage Goals

- Setup flow: 100%
- Chat functionality: 80%
- Workflows: 90%
- Keyword masking: 90%
- Settings: 70%
- Mode-specific features: 80%

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-page)
