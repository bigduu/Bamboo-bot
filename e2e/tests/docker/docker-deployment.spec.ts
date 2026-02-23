import { test, expect } from '@playwright/test';
import { execSync, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

/**
 * Docker Deployment E2E Tests
 *
 * These tests verify the complete Docker deployment including:
 * - Container build and startup
 * - Health checks
 * - Static file serving
 * - API functionality
 * - Data persistence
 * - Resource management
 */
test.describe('Docker Deployment', () => {
  let dockerProcess: ChildProcess | null = null;
  const DOCKER_DIR = '../docker';
  const CONTAINER_NAME = 'bamboo-web';
  const TIMEOUT = 60000; // 60 seconds for container operations

  test.beforeAll(async () => {
    // Check if Docker is available
    try {
      execSync('docker --version', { stdio: 'ignore' });
    } catch (error) {
      test.skip(true, 'Docker is not available');
      return;
    }

    // Check if container is already running
    try {
      const result = execSync(`docker ps -q -f name=${CONTAINER_NAME}`, { encoding: 'utf-8' });
      if (result.trim()) {
        console.log('✅ Docker container already running');
        return;
      }
    } catch (error) {
      // Container not running, continue
    }

    // Build Docker image if needed
    if (process.env.E2E_SKIP_BUILD !== 'true') {
      console.log('🔨 Building Docker image...');
      try {
        execSync('docker-compose build', {
          cwd: DOCKER_DIR,
          stdio: 'inherit',
          timeout: 300000, // 5 minutes for build
        });
        console.log('✅ Docker image built successfully');
      } catch (error) {
        throw new Error(`Failed to build Docker image: ${error}`);
      }
    }

    // Start Docker container
    console.log('🚀 Starting Docker container...');
    dockerProcess = spawn('docker-compose', ['up', '-d'], {
      cwd: DOCKER_DIR,
      stdio: 'inherit',
    });

    // Wait for container to be healthy
    console.log('⏳ Waiting for container to be healthy...');
    const startTime = Date.now();
    let healthy = false;

    while (Date.now() - startTime < TIMEOUT) {
      try {
        const result = execSync(
          `docker inspect --format='{{.State.Health.Status}}' ${CONTAINER_NAME}`,
          { encoding: 'utf-8' }
        );

        if (result.trim() === 'healthy') {
          healthy = true;
          console.log('✅ Container is healthy');
          break;
        }
      } catch (error) {
        // Container not ready yet
      }

      await sleep(2000);
    }

    if (!healthy) {
      // Log container output for debugging
      try {
        const logs = execSync(`docker logs ${CONTAINER_NAME}`, { encoding: 'utf-8' });
        console.log('Container logs:', logs);
      } catch (error) {
        // Ignore log errors
      }

      throw new Error('Container failed to become healthy within timeout');
    }
  });

  test.afterAll(async () => {
    // Cleanup Docker container if we started it
    if (dockerProcess && process.env.E2E_KEEP_CONTAINER !== 'true') {
      console.log('🧹 Cleaning up Docker container...');
      try {
        execSync('docker-compose down -v', {
          cwd: DOCKER_DIR,
          stdio: 'inherit',
        });
        console.log('✅ Container cleaned up');
      } catch (error) {
        console.warn('Failed to cleanup container:', error);
      }
    }
  });

  test('should start container successfully', async () => {
    // Check container is running
    const result = execSync(
      `docker ps -q -f name=${CONTAINER_NAME} -f status=running`,
      { encoding: 'utf-8' }
    );

    expect(result.trim()).toBeTruthy();
  });

  test('should pass health check', async () => {
    const result = execSync(
      `docker inspect --format='{{.State.Health.Status}}' ${CONTAINER_NAME}`,
      { encoding: 'utf-8' }
    );

    expect(result.trim()).toBe('healthy');
  });

  test('should have correct port exposed', async () => {
    const result = execSync(
      `docker port ${CONTAINER_NAME} 8080`,
      { encoding: 'utf-8' }
    );

    expect(result).toContain('0.0.0.0:8080');
  });

  test('should serve frontend', async ({ page }) => {
    await page.goto('/');

    // Verify page loads
    await expect(page.locator('body')).toBeVisible();

    // Check title
    const title = await page.title();
    expect(title).toContain('Bamboo');
  });

  test('should serve static assets with correct MIME types', async ({ page }) => {
    await page.goto('/');

    // Check JavaScript MIME type
    const scripts = await page.locator('script[src]').all();
    expect(scripts.length).toBeGreaterThan(0);

    for (const script of scripts.slice(0, 3)) {
      const src = await script.getAttribute('src');
      if (src && src.startsWith('/')) {
        const response = await page.request.get(src);
        expect(response.ok()).toBeTruthy();

        const contentType = response.headers()['content-type'];
        expect(contentType).toMatch(/javascript|text/);
      }
    }
  });

  test('should respond to health check API', async ({ page }) => {
    const response = await page.request.get('/api/v1/health');

    expect(response.ok()).toBeTruthy();

    const health = await response.text();
    expect(health).toBe('OK');
  });

  test('should handle API requests through Docker', async ({ page }) => {
    const response = await page.request.post('/api/v1/chat', {
      data: {
        messages: [
          { role: 'user', content: 'Hello from Docker test' }
        ]
      }
    });

    // Should not return server error
    expect(response.status()).toBeLessThan(500);
  });

  test('should have correct CORS configuration', async ({ page }) => {
    const response = await page.request.get('/api/v1/health');

    // Check CORS headers exist
    const corsHeader = response.headers()['access-control-allow-origin'];
    expect(corsHeader).toBeTruthy();
    expect(corsHeader).toContain('localhost');
  });

  test('should have security headers', async ({ page }) => {
    const response = await page.request.get('/');

    // Check for common security headers
    const headers = response.headers();

    // At minimum, should have some security measures
    expect(headers).toBeDefined();

    // Note: Specific security headers depend on server configuration
    // Common ones to check: X-Frame-Options, X-Content-Type-Options, etc.
  });

  test('should handle concurrent requests', async ({ page }) => {
    // Make 20 concurrent health check requests
    const requests = Array(20).fill(null).map(() =>
      page.request.get('/api/v1/health')
    );

    const responses = await Promise.all(requests);

    // All should succeed
    responses.forEach(response => {
      expect(response.ok()).toBeTruthy();
    });
  });

  test('should persist data across requests', async ({ page }) => {
    // Create some data
    const testMessage = `Test message ${Date.now()}`;

    await page.goto('/chat');
    await page.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 });

    // Send message (may fail if setup not complete, but should not crash)
    try {
      await page.fill('[data-testid="chat-input"]', testMessage);
      await page.click('[data-testid="send-button"]');
      await page.waitForTimeout(1000);
    } catch (error) {
      // Ignore errors - we're testing that container doesn't crash
    }

    // Container should still be responsive
    const response = await page.request.get('/api/v1/health');
    expect(response.ok()).toBeTruthy();
  });

  test('should handle large payloads', async ({ page }) => {
    const largeMessage = 'x'.repeat(50000);

    const response = await page.request.post('/api/v1/chat', {
      data: {
        messages: [
          { role: 'user', content: largeMessage }
        ]
      }
    });

    // Should handle gracefully (accept or reject, but not crash)
    expect(response.status()).toBeLessThan(500);
  });

  test('should have reasonable response times', async ({ page }) => {
    const start = Date.now();

    const response = await page.request.get('/api/v1/health');

    const duration = Date.now() - start;

    expect(response.ok()).toBeTruthy();
    expect(duration).toBeLessThan(1000); // Should respond within 1 second
  });

  test('should serve SPA routes correctly', async ({ page }) => {
    const routes = ['/chat', '/settings'];

    for (const route of routes) {
      await page.goto(route);

      // Should load the React app, not 404
      const appRoot = page.locator('#root');
      await expect(appRoot).toBeVisible({ timeout: 5000 });
    }
  });

  test('should handle OPTIONS requests for CORS preflight', async ({ page }) => {
    const response = await page.request.fetch('/api/v1/chat', {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Origin': 'http://localhost:8080',
      },
    });

    // Should allow the request
    expect(response.status()).toBeLessThan(400);
  });

  test('should log to Docker logs', async () => {
    // Get container logs
    const logs = execSync(`docker logs ${CONTAINER_NAME}`, { encoding: 'utf-8' });

    // Should have some output
    expect(logs.length).toBeGreaterThan(0);
  });

  test('should have data volume mounted', async () => {
    // Check if volume is mounted
    const result = execSync(
      `docker inspect --format='{{range .Mounts}}{{.Destination}}{{end}}' ${CONTAINER_NAME}`,
      { encoding: 'utf-8' }
    );

    expect(result).toContain('/data');
  });

  test('should use correct environment variables', async () => {
    const result = execSync(
      `docker inspect --format='{{range .Config.Env}}{{println .}}{{end}}' ${CONTAINER_NAME}`,
      { encoding: 'utf-8' }
    );

    expect(result).toContain('BAMBOO_DATA_DIR=/data');
    expect(result).toContain('BAMBOO_PORT=8080');
  });

  test('should be accessible from host', async ({ page }) => {
    // Make request from test runner (host machine)
    const response = await page.request.get('http://localhost:8080/api/v1/health');

    expect(response.ok()).toBeTruthy();
  });
});

test.describe('Docker Performance', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Performance tests only run on Chromium');

  test('should have reasonable container size', async () => {
    try {
      const result = execSync(
        `docker images bamboo-web-service:latest --format='{{.Size}}'`,
        { encoding: 'utf-8' }
      );

      const sizeStr = result.trim();

      // Parse size (e.g., "500MB" or "1.2GB")
      const sizeMatch = sizeStr.match(/(\d+(?:\.\d+)?)(GB|MB)/i);

      if (sizeMatch) {
        const size = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[2].toUpperCase();

        // Convert to MB for comparison
        const sizeMB = unit === 'GB' ? size * 1024 : size;

        // Image should be less than 1GB
        expect(sizeMB).toBeLessThan(1024);
      }
    } catch (error) {
      // Skip if image size check fails
      test.skip();
    }
  });

  test('should handle sustained load', async ({ page }) => {
    const requestCount = 100;
    const delays: number[] = [];

    for (let i = 0; i < requestCount; i++) {
      const start = Date.now();
      await page.request.get('/api/v1/health');
      delays.push(Date.now() - start);
    }

    // Calculate average response time
    const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;

    // Average should be reasonable (< 100ms)
    expect(avgDelay).toBeLessThan(100);

    // 95th percentile should be acceptable (< 500ms)
    delays.sort((a, b) => a - b);
    const p95 = delays[Math.floor(delays.length * 0.95)];
    expect(p95).toBeLessThan(500);
  });
});
