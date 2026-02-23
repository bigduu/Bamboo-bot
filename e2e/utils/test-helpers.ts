import { Page, expect } from '@playwright/test';

export async function waitForAppReady(page: Page) {
  // Wait for app to be fully loaded
  await page.waitForLoadState('networkidle');

  // Wait for React to hydrate
  await page.waitForFunction(() => {
    const root = document.querySelector('#root');
    return root && root.children.length > 0;
  });
}

export async function completeSetupIfNeeded(page: Page) {
  // Check if setup is needed
  await page.goto('/');

  const setupWizard = page.locator('[data-testid="setup-wizard"]');
  const isVisible = await setupWizard.isVisible().catch(() => false);

  if (isVisible) {
    // Complete setup
    await page.fill('[data-testid="api-key-input"]', 'test-api-key');
    await page.click('[data-testid="setup-next"]');

    // Wait for redirect to chat
    await page.waitForURL(/.*\/chat/, { timeout: 10000 });
  }
}

export async function clearChatHistory(page: Page) {
  await page.goto('/chat');

  // Click clear history button if available
  const clearButton = page.locator('[data-testid="clear-history"]');

  if (await clearButton.isVisible().catch(() => false)) {
    await clearButton.click();

    // Confirm deletion
    const confirmButton = page.locator('[data-testid="confirm-clear"]');
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
    }
  }
}

export async function takeScreenshotOnFailure(page: Page, testName: string) {
  const screenshot = await page.screenshot({
    path: `test-results/${testName}-failure.png`,
    fullPage: true
  });

  return screenshot;
}

export async function mockApiError(page: Page, endpoint: string, status: number = 500) {
  await page.route(`**/api/v1/${endpoint}`, route => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Test error' })
    });
  });
}

export async function mockApiResponse(page: Page, endpoint: string, data: any, status: number = 200) {
  await page.route(`**/api/v1/${endpoint}`, route => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(data)
    });
  });
}

export async function waitForToast(page: Page, expectedText?: string, timeout = 5000) {
  const toast = page.locator('[data-testid="toast-message"]');

  await toast.waitFor({ state: 'visible', timeout });

  if (expectedText) {
    await expect(toast).toContainText(expectedText);
  }

  return toast;
}

export async function dismissToast(page: Page) {
  const closeButton = page.locator('[data-testid="toast-close"]');

  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }
}

export async function checkAccessibility(page: Page) {
  // Basic accessibility checks
  const violations: string[] = [];

  // Check for alt text on images
  const images = await page.locator('img').all();
  for (const img of images) {
    const alt = await img.getAttribute('alt');
    if (alt === null) {
      violations.push('Image missing alt text');
    }
  }

  // Check for form labels
  const inputs = await page.locator('input, textarea, select').all();
  for (const input of inputs) {
    const id = await input.getAttribute('id');
    if (id) {
      const label = await page.locator(`label[for="${id}"]`).count();
      if (label === 0) {
        violations.push(`Input ${id} missing label`);
      }
    }
  }

  // Check for heading hierarchy
  const h1 = await page.locator('h1').count();
  if (h1 > 1) {
    violations.push('Multiple h1 headings found');
  }

  return violations;
}

export async function measurePerformance(page: Page) {
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    return {
      loadTime: navigation.loadEventEnd - navigation.startTime,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.startTime,
      firstPaint: navigation.responseStart - navigation.startTime,
      transferSize: navigation.transferSize,
    };
  });

  return metrics;
}

export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

export async function waitForAnimation(page: Page, selector: string) {
  // Wait for element to be visible and animations to complete
  await page.waitForSelector(selector, { state: 'visible' });

  await page.waitForFunction((sel) => {
    const element = document.querySelector(sel);
    if (!element) return false;

    const animations = element.getAnimations();
    return animations.every(anim => anim.playState === 'finished');
  }, selector);
}

export function generateTestName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function debugPageState(page: Page) {
  const url = page.url();
  const title = await page.title();

  const consoleLogs: string[] = [];
  page.on('console', msg => consoleLogs.push(msg.text()));

  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  return {
    url,
    title,
    consoleLogs,
    errors
  };
}

/**
 * Fill a React controlled input and trigger proper events
 * This ensures that React state updates correctly when filling inputs
 */
export async function fillReactInput(
  page: Page,
  selector: string,
  value: string
): Promise<void> {
  // Use evaluate to bypass React's value interception
  await page.evaluate((args) => {
    const textarea = document.querySelector(args.selector) as HTMLTextAreaElement;
    if (!textarea) {
      throw new Error(`Element not found: ${args.selector}`);
    }

    // Get React's fiber node
    const fiberKey = Object.keys(textarea).find(key => key.startsWith('__reactFiber'));
    if (!fiberKey) {
      throw new Error('React fiber not found on element');
    }

    // Get the native input value setter
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;

    if (!nativeInputValueSetter) {
      throw new Error('Native input value setter not found');
    }

    // Set the value using the native setter (bypasses React's interception)
    nativeInputValueSetter.call(textarea, args.value);

    // Create and dispatch React-compatible events
    const inputEvent = new Event('input', { bubbles: true });
    Object.defineProperty(inputEvent, 'target', {
      value: textarea,
      writable: false
    });
    textarea.dispatchEvent(inputEvent);

    // Also dispatch change event
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    // Trigger React's onChange handler by simulating character input
    textarea.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }, { selector, value });

  // Wait for React to process
  await page.waitForTimeout(300);

  // Verify the value was set
  const input = page.locator(selector);
  const actualValue = await input.inputValue();
  console.log(`fillReactInput: Expected "${value}", got "${actualValue}"`);

  if (actualValue !== value) {
    throw new Error(`Failed to set input value. Expected "${value}", got "${actualValue}"`);
  }
}

/**
 * Wait for an input to be enabled (not disabled)
 */
export async function waitForInputEnabled(
  page: Page,
  selector: string,
  timeout = 5000
): Promise<void> {
  const input = page.locator(selector);
  await input.waitFor({ state: 'visible', timeout });

  // Wait for the disabled attribute to be removed
  await page.waitForFunction(
    (sel) => {
      const element = document.querySelector(sel);
      return element && !element.hasAttribute('disabled');
    },
    selector,
    { timeout }
  );
}

/**
 * Wait for a button to be enabled (not disabled)
 */
export async function waitForButtonEnabled(
  page: Page,
  selector: string,
  timeout = 5000
): Promise<void> {
  const button = page.locator(selector);
  await button.waitFor({ state: 'visible', timeout });

  // Wait for the disabled attribute to be removed
  await page.waitForFunction(
    (sel) => {
      const element = document.querySelector(sel);
      return element && !element.hasAttribute('disabled');
    },
    selector,
    { timeout }
  );
}

