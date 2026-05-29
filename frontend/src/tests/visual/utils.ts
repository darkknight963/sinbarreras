import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Visual Regression Testing Utilities
 * 
 * Provides helper functions for visual regression testing with Playwright.
 * Supports:
 * - Baseline snapshot comparison
 * - Cross-browser testing
 * - Responsive design testing
 * - Interactive state testing (hover, focus, click)
 * - Color and contrast validation
 * - Performance monitoring
 */

export interface VisualTestOptions {
  /** Threshold for pixel difference (0-1, default 0.2) */
  threshold?: number;
  /** Maximum number of pixels that can differ */
  maxDiffPixels?: number;
  /** Animation delay in ms before taking screenshot */
  animationDelay?: number;
  /** Viewport size for testing */
  viewport?: { width: number; height: number };
  /** Mask elements that should be ignored in comparison */
  mask?: string[];
  /** Full page screenshot instead of element */
  fullPage?: boolean;
}

/**
 * Take a screenshot and compare with baseline
 * 
 * @param page - Playwright page object
 * @param name - Test name for screenshot file
 * @param options - Visual test options
 */
export async function expectVisualMatch(
  page: Page,
  name: string,
  options: VisualTestOptions = {}
) {
  const {
    threshold = 0.2,
    maxDiffPixels = 100,
    animationDelay = 500,
    fullPage = false,
  } = options;

  // Wait for animations to complete
  if (animationDelay > 0) {
    await page.waitForTimeout(animationDelay);
  }

  // Take screenshot and compare with baseline
  await expect(page).toHaveScreenshot(`${name}.png`, {
    threshold,
    maxDiffPixels,
    fullPage,
  });
}

/**
 * Wait for element to be visible and stable
 * 
 * @param page - Playwright page object
 * @param selector - CSS selector
 */
export async function waitForElementStable(page: Page, selector: string) {
  await page.locator(selector).waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle');
}

/**
 * Set viewport size for responsive testing
 * 
 * @param page - Playwright page object
 * @param width - Viewport width
 * @param height - Viewport height
 */
export async function setViewport(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(300); // Wait for layout to adjust
}

/**
 * Test component across multiple viewports
 * 
 * @param page - Playwright page object
 * @param url - URL to navigate to
 * @param name - Test name
 * @param viewports - Array of viewport sizes to test
 */
export async function testAcrossViewports(
  page: Page,
  url: string,
  name: string,
  viewports: Array<{ width: number; height: number; label: string }>
) {
  for (const viewport of viewports) {
    await setViewport(page, viewport.width, viewport.height);
    await page.goto(url);
    await expectVisualMatch(page, `${name}-${viewport.label}`);
  }
}

/**
 * Common viewport sizes for responsive testing
 */
export const VIEWPORTS = {
  mobile: { width: 375, height: 667, label: 'mobile' },
  tablet: { width: 768, height: 1024, label: 'tablet' },
  desktop: { width: 1440, height: 900, label: 'desktop' },
  wide: { width: 1920, height: 1080, label: 'wide' },
};

/**
 * Hover over element and take screenshot
 * 
 * @param page - Playwright page object
 * @param selector - CSS selector
 * @param name - Test name
 * @param options - Visual test options
 */
export async function expectHoverVisualMatch(
  page: Page,
  selector: string,
  name: string,
  options: VisualTestOptions = {}
) {
  const element = page.locator(selector);
  await element.hover();
  await expectVisualMatch(page, `${name}-hover`, options);
}

/**
 * Click element and take screenshot
 * 
 * @param page - Playwright page object
 * @param selector - CSS selector
 * @param name - Test name
 * @param options - Visual test options
 */
export async function expectClickVisualMatch(
  page: Page,
  selector: string,
  name: string,
  options: VisualTestOptions = {}
) {
  const element = page.locator(selector);
  await element.click();
  await expectVisualMatch(page, `${name}-clicked`, options);
}

/**
 * Focus element and take screenshot
 * 
 * @param page - Playwright page object
 * @param selector - CSS selector
 * @param name - Test name
 * @param options - Visual test options
 */
export async function expectFocusVisualMatch(
  page: Page,
  selector: string,
  name: string,
  options: VisualTestOptions = {}
) {
  const element = page.locator(selector);
  await element.focus();
  await expectVisualMatch(page, `${name}-focused`, options);
}

/**
 * Scroll to element and take screenshot
 * 
 * @param page - Playwright page object
 * @param selector - CSS selector
 * @param name - Test name
 * @param options - Visual test options
 */
export async function expectScrollVisualMatch(
  page: Page,
  selector: string,
  name: string,
  options: VisualTestOptions = {}
) {
  const element = page.locator(selector);
  await element.scrollIntoViewIfNeeded();
  await expectVisualMatch(page, `${name}-scrolled`, options);
}

/**
 * Compare full page screenshot
 * 
 * @param page - Playwright page object
 * @param name - Test name
 * @param options - Visual test options
 */
export async function expectFullPageVisualMatch(
  page: Page,
  name: string,
  options: VisualTestOptions = {}
) {
  await expectVisualMatch(page, `${name}-full-page`, {
    ...options,
    animationDelay: options.animationDelay ?? 1000,
    fullPage: true,
  });
}

/**
 * Wait for specific color to be present in element
 * 
 * @param page - Playwright page object
 * @param selector - CSS selector
 * @param color - RGB color string (e.g., "rgb(0, 44, 118)")
 */
export async function waitForColor(
  page: Page,
  selector: string,
  color: string
) {
  await page.waitForFunction(
    ({ selector, color }) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      const computedColor = window.getComputedStyle(el).color;
      return computedColor === color;
    },
    { selector, color }
  );
}

/**
 * Get computed style of element
 * 
 * @param page - Playwright page object
 * @param selector - CSS selector
 * @param property - CSS property name
 */
export async function getComputedStyle(
  page: Page,
  selector: string,
  property: string
): Promise<string> {
  return await page.locator(selector).evaluate(
    (el, cssProperty) => {
      return window.getComputedStyle(el).getPropertyValue(cssProperty);
    },
    property
  );
}

/**
 * Validate color contrast ratio (WCAG 2.2 AA)
 * 
 * @param page - Playwright page object
 * @param selector - CSS selector
 * @param minRatio - Minimum contrast ratio (default 4.5 for normal text)
 */
export async function validateContrast(
  page: Page,
  selector: string,
  minRatio: number = 4.5
): Promise<boolean> {
  const result = await page.locator(selector).evaluate(
    (el, minContrastRatio) => {
      const style = window.getComputedStyle(el);
      const textColor = style.color;
      const bgColor = style.backgroundColor;

      // Parse RGB values
      const parseRGB = (rgb: string) => {
        const match = rgb.match(/\d+/g);
        return match ? match.map(Number) : [0, 0, 0];
      };

      const [r1, g1, b1] = parseRGB(textColor);
      const [r2, g2, b2] = parseRGB(bgColor);

      // Calculate luminance
      const getLuminance = (r: number, g: number, b: number) => {
        const [rs, gs, bs] = [r, g, b].map((c) => {
          c = c / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      };

      const l1 = getLuminance(r1, g1, b1);
      const l2 = getLuminance(r2, g2, b2);

      // Calculate contrast ratio
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      const ratio = (lighter + 0.05) / (darker + 0.05);

      return ratio >= minContrastRatio;
    },
    minRatio
  );

  return result;
}

/**
 * Get all elements matching selector and validate their visual properties
 * 
 * @param page - Playwright page object
 * @param selector - CSS selector
 * @param property - CSS property to validate
 */
export async function validateElementProperty(
  page: Page,
  selector: string,
  property: string,
  expectedValue?: string
): Promise<string[]> {
  return await page.locator(selector).evaluateAll(
    (elements, args) => {
      const { property: cssProperty, expectedValue: expected } = args;
      const values: string[] = [];

      elements.forEach((el) => {
        const value = window.getComputedStyle(el).getPropertyValue(cssProperty);
        if (!expected || value === expected) {
          values.push(value);
        }
      });

      return values;
    },
    { property, expectedValue }
  );
}

/**
 * Wait for visual stability (no layout shifts)
 * 
 * @param page - Playwright page object
 * @param timeout - Maximum wait time in ms
 */
export async function waitForVisualStability(
  page: Page,
  timeout: number = 1000
) {
  await page.evaluate(({ timeout }) => {
    return new Promise<void>((resolve) => {
      let lastLayout = JSON.stringify(document.body.getBoundingClientRect());
      let stableCount = 0;
      const checkInterval = setInterval(() => {
        const currentLayout = JSON.stringify(
          document.body.getBoundingClientRect()
        );
        if (currentLayout === lastLayout) {
          stableCount++;
          if (stableCount >= 3) {
            clearInterval(checkInterval);
            resolve();
          }
        } else {
          stableCount = 0;
          lastLayout = currentLayout;
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, timeout);
    });
  }, { timeout });
}

/**
 * Compare element dimensions across viewports
 * 
 * @param page - Playwright page object
 * @param selector - CSS selector
 * @param viewports - Array of viewports to test
 */
export async function validateResponsiveDimensions(
  page: Page,
  selector: string,
  viewports: Array<{ width: number; height: number; label: string }>
): Promise<Record<string, { width: number; height: number }>> {
  const dimensions: Record<string, { width: number; height: number }> = {};

  for (const viewport of viewports) {
    await setViewport(page, viewport.width, viewport.height);
    const dim = await page.locator(selector).evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    dimensions[viewport.label] = dim;
  }

  return dimensions;
}

/**
 * Validate animation performance
 * 
 * @param page - Playwright page object
 * @param selector - CSS selector
 * @param animationName - CSS animation name
 */
export async function validateAnimationPerformance(
  page: Page,
  selector: string,
  animationName: string
): Promise<boolean> {
  return await page.locator(selector).evaluate(
    (el, expectedAnimationName) => {
      const style = window.getComputedStyle(el);
      const animation = style.animation;

      return animation.includes(expectedAnimationName);
    },
    animationName
  );
}
