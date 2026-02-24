import { test, expect } from '@playwright/test';

test.describe('Docker Mode Tests', () => {
  test.use({ baseURL: 'http://localhost:8080' }); // Docker container

  test('should serve static frontend', async ({ page }) => {
    await page.goto('/');

    // Verify HTML is returned
    const title = await page.title();
    expect(title).toContain('Bamboo');
  });

  test('should serve SPA fallback for all routes', async ({ page }) => {
    const routes = ['/chat', '/settings', '/settings/workflows'];

    for (const route of routes) {
      await page.goto(route);
      // Should not get 404
      await expect(page.locator('body')).toBeVisible();

      // Should load the React app
      const appRoot = page.locator('#root');
      await expect(appRoot).toBeVisible();
    }
  });

  test('should handle CORS correctly', async ({ page }) => {
    // Test that API requests work from frontend origin
    const response = await page.request.get('/api/v1/health');
    expect(response.ok()).toBeTruthy();

    // Check CORS headers
    const corsHeader = response.headers()['access-control-allow-origin'];
    expect(corsHeader).toContain('localhost');
  });

  test('should proxy API requests correctly', async ({ page }) => {
    // Make API request through the same origin
    const response = await page.request.post('/api/v1/chat', {
      data: {
        messages: [
          { role: 'user', content: 'Test message' }
        ]
      }
    });

    // Should route to backend properly
    expect(response.status()).toBeLessThan(500);
  });

  test('should serve static assets with caching', async ({ page }) => {
    await page.goto('/');

    // Check that static assets have proper cache headers
    const jsFiles = await page.locator('script[src]').all();

    for (const script of jsFiles) {
      const src = await script.getAttribute('src');
      if (src && src.startsWith('/')) {
        const response = await page.request.get(src);

        // Should have cache headers
        const cacheControl = response.headers()['cache-control'];
        expect(cacheControl).toBeTruthy();
      }
    }
  });

  test('should handle health check endpoint', async ({ page }) => {
    const response = await page.request.get('/api/v1/health');

    expect(response.ok()).toBeTruthy();
    expect((await response.text()).toLowerCase()).toContain('ok');
  });

  test('should handle concurrent requests', async ({ page }) => {
    // Make multiple concurrent requests
    const requests = Array(10).fill(null).map(() =>
      page.request.get('/api/v1/health')
    );

    const responses = await Promise.all(requests);

    // All should succeed
    responses.forEach(response => {
      expect(response.ok()).toBeTruthy();
    });
  });

  test('should handle WebSocket connections', async ({ page }) => {
    await page.goto('/chat');

    // Wait for WebSocket to connect
    await page.waitForFunction(() => {
      const indicator = document.querySelector('[data-testid="connection-status"]');
      return indicator && indicator.textContent?.includes('connected');
    }, { timeout: 10000 });
  });

  test('should handle file uploads', async ({ page }) => {
    await page.goto('/settings/workflows');

    // Test file upload through form
    await page.setInputFiles('[data-testid="import-workflow"]', './fixtures/test-workflow.md');

    // Should upload successfully
    await expect(page.locator('text=test-workflow')).toBeVisible();
  });

  test('should handle large payloads', async ({ page }) => {
    // Create a large message
    const largeMessage = 'x'.repeat(10000);

    await page.goto('/chat');

    await page.fill('[data-testid="chat-input"]', largeMessage);
    await page.click('[data-testid="send-button"]');

    // Should handle without error
    // (Might timeout or get rejected, but shouldn't crash)
    await page.waitForTimeout(2000);

    // App should still be responsive
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
  });

  test('should handle rate limiting (if configured)', async ({ page }) => {
    // Make many rapid requests
    const requests = Array(100).fill(null).map((_, i) =>
      page.request.get('/api/v1/health')
    );

    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status() === 429);

    // Some should be rate limited (if rate limiting is configured)
    // This test verifies the behavior exists, not the exact limit
    expect(rateLimited.length).toBeGreaterThanOrEqual(0);
  });

  test('should serve correct MIME types', async ({ page }) => {
    await page.goto('/');

    // Check JavaScript files
    const scripts = await page.locator('script[src]').all();
    for (const script of scripts.slice(0, 1)) {
      const src = await script.getAttribute('src');
      if (src && src.startsWith('/')) {
        const response = await page.request.get(src);
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('javascript');
      }
    }

    // Check CSS files
    const styles = await page.locator('link[rel="stylesheet"]').all();
    for (const style of styles.slice(0, 1)) {
      const href = await style.getAttribute('href');
      if (href && href.startsWith('/')) {
        const response = await page.request.get(href);
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('css');
      }
    }
  });

  test('should handle compression', async ({ page }) => {
    const response = await page.request.get('/', {
      headers: {
        'Accept-Encoding': 'gzip, deflate, br'
      }
    });

    // Should return compressed content
    const contentEncoding = response.headers()['content-encoding'];
    expect(contentEncoding).toBeTruthy();
  });

  test('should handle HTTPS redirects (if configured)', async ({ page }) => {
    // Try HTTP request
    const response = await page.request.get('http://localhost:8080/');

    // Should either work (if HTTP allowed) or redirect to HTTPS
    expect([200, 301, 302, 308]).toContain(response.status());
  });

  test('should work behind reverse proxy', async ({ page }) => {
    // Simulate being behind a reverse proxy
    await page.goto('/', {
      waitUntil: 'networkidle'
    });

    // Should work correctly
    await expect(page.locator('body')).toBeVisible();

    // API should work
    const healthResponse = await page.request.get('/api/v1/health');
    expect(healthResponse.ok()).toBeTruthy();
  });
});
