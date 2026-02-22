import { test, expect } from '@playwright/test';

test.describe('Debug Input Issue', () => {
  test('should debug chat input field', async ({ page }) => {
    // Capture console logs and errors
    const consoleLogs: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    // Navigate to chat page
    await page.goto('/chat');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Find the input
    const input = page.locator('[data-testid="chat-input"]');

    // Check if input exists and is visible
    console.log('=== Input Element Check ===');
    const isVisible = await input.isVisible();
    const isEditable = await input.isEditable();
    const isDisabled = await input.isDisabled();
    const isEnabled = await input.isEnabled();

    console.log(`Visible: ${isVisible}`);
    console.log(`Editable: ${isEditable}`);
    console.log(`Disabled: ${isDisabled}`);
    console.log(`Enabled: ${isEnabled}`);

    // Get element attributes
    const tagName = await input.evaluate(el => el.tagName);
    const placeholder = await input.getAttribute('placeholder');
    const disabled = await input.getAttribute('disabled');
    const readOnly = await input.getAttribute('readonly');

    console.log(`Tag: ${tagName}`);
    console.log(`Placeholder: ${placeholder}`);
    console.log(`Disabled attr: ${disabled}`);
    console.log(`Readonly attr: ${readOnly}`);

    // Get computed styles
    const styles = await input.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        display: computed.display,
        visibility: computed.visibility,
        opacity: computed.opacity,
        pointerEvents: computed.pointerEvents,
        zIndex: computed.zIndex,
        position: computed.position,
        color: computed.color,
        background: computed.background
      };
    });

    console.log('Computed Styles:', styles);

    // Check if there's an overlay covering the input
    const hasOverlay = await page.evaluate(() => {
      const textarea = document.querySelector('[data-testid="chat-input"]');
      if (!textarea) return false;

      const rect = textarea.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const elementAtPoint = document.elementFromPoint(centerX, centerY);
      console.log('Element at center:', elementAtPoint?.tagName, elementAtPoint?.className);

      return elementAtPoint !== textarea && !textarea.contains(elementAtPoint);
    });

    console.log(`Has overlay: ${hasOverlay}`);

    // Check all textareas on the page
    const allTextareas = await page.evaluate(() => {
      const areas = document.querySelectorAll('textarea');
      return Array.from(areas).map(ta => ({
        testId: ta.getAttribute('data-testid'),
        className: ta.className,
        value: ta.value,
        hidden: ta.hidden,
        display: getComputedStyle(ta).display,
        visibility: getComputedStyle(ta).visibility,
        disabled: ta.disabled,
        readOnly: ta.readOnly
      }));
    });

    console.log('\n=== All Textareas on Page ===');
    console.log(`Found ${allTextareas.length} textarea(s)`);
    allTextareas.forEach((ta, i) => {
      console.log(`Textarea ${i}:`, ta);
    });

    // Check how many elements match our selector
    const inputCount = await input.count();
    console.log(`\nElements with data-testid="chat-input": ${inputCount}`);

    // Try to get the actual textarea element (might be inside Ant Design wrapper)
    const textareaInfo = await page.evaluate(() => {
      const textarea = document.querySelector('[data-testid="chat-input"]') as HTMLTextAreaElement;
      if (!textarea) return null;

      return {
        value: textarea.value,
        textContent: textarea.textContent,
        innerHTML: textarea.innerHTML
      };
    });

    console.log('Textarea content:', textareaInfo);

    // Try different methods to fill
    console.log('\n=== Trying fill() ===');
    try {
      await input.click();
      await input.fill('Test 1');
      const value1 = await input.inputValue();
      console.log(`fill() result: "${value1}"`);
    } catch (e) {
      console.log(`fill() error: ${e.message}`);
    }

    console.log('\n=== Trying type() ===');
    try {
      await input.clear();
      await input.type('Test 2', { delay: 100 });
      const value2 = await input.inputValue();
      console.log(`type() result: "${value2}"`);
    } catch (e) {
      console.log(`type() error: ${e.message}`);
    }

    console.log('\n=== Trying direct DOM manipulation ===');
    try {
      const value3 = await page.evaluate(() => {
        const textarea = document.querySelector('[data-testid="chat-input"]') as HTMLTextAreaElement;
        if (!textarea) return 'element not found';

        // Try setting value directly
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        )?.set;

        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(textarea, 'Test 3');
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));

          // Check immediately
          const val = textarea.value;
          console.log('Direct set - textarea.value:', val);

          // Check after a bit
          setTimeout(() => {
            console.log('After 100ms - textarea.value:', textarea.value);
          }, 100);

          return val;
        }

        return 'setter not found';
      });
      console.log(`Direct DOM result: "${value3}"`);

      // Wait a bit and check again via Playwright
      await page.waitForTimeout(200);
      const valueAfter = await input.inputValue();
      console.log(`Playwright inputValue() after DOM manipulation: "${valueAfter}"`);
    } catch (e) {
      console.log(`Direct DOM error: ${e.message}`);
    }

    // Try pressing keys instead of fill
    console.log('\n=== Trying keyboard input ===');
    try {
      await input.focus();
      await page.keyboard.type('Test 4', { delay: 50 });
      const value4 = await input.inputValue();
      console.log(`keyboard.type() result: "${value4}"`);

      // Also check via evaluate
      const value4Dom = await input.evaluate(el => (el as HTMLTextAreaElement).value);
      console.log(`DOM value after keyboard: "${value4Dom}"`);
    } catch (e) {
      console.log(`keyboard error: ${e.message}`);
    }

    // Check React DevTools if available
    const reactInfo = await page.evaluate(() => {
      const textarea = document.querySelector('[data-testid="chat-input"]');
      if (!textarea) return null;

      // Try to find React fiber
      const fiberKey = Object.keys(textarea).find(key => key.startsWith('__reactFiber'));
      if (!fiberKey) return { hasReact: false };

      return {
        hasReact: true,
        fiberKey: fiberKey
      };
    });

    console.log('React info:', reactInfo);

    // Print all console logs
    console.log('\n=== Browser Console Logs ===');
    consoleLogs.forEach(log => console.log(log));

    // Print any errors
    if (pageErrors.length > 0) {
      console.log('\n=== Page Errors ===');
      pageErrors.forEach(error => console.log(error));
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/debug-input.png', fullPage: true });
  });
});
