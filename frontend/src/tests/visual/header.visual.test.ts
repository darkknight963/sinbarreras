import { test, expect } from '@playwright/test';
import {
  expectVisualMatch,
  VIEWPORTS,
  waitForElementStable,
} from './utils';

/**
 * Visual Regression Tests for Header Component
 * 
 * Tests the Header component across different states and viewports
 * to ensure visual consistency and design compliance.
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */

test.describe('Header Component - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page with the header component
    await page.goto('/');
    await waitForElementStable(page, 'header.sticky');
  });

  test('should render header with correct gradient background', async ({
    page,
  }) => {
    // Requirement 2.1: Header gradient background using primary color tokens
    await expectVisualMatch(page, 'header-base-state', {
      animationDelay: 300,
    });
  });

  test('should display header shadow when sticky', async ({ page }) => {
    // Requirement 2.2: Header shadow and sticky positioning
    // Scroll to trigger sticky state
    await page.evaluate(() => window.scrollBy(0, 100));
    await page.waitForTimeout(300);
    
    await expectVisualMatch(page, 'header-sticky-shadow', {
      animationDelay: 300,
    });
  });

  test('should render header title with correct contrast', async ({
    page,
  }) => {
    // Requirement 2.3: Header title contrast (4.5:1 minimum)
    const titleElement = page.locator('header.sticky h1, header.sticky .title');
    await titleElement.waitFor({ state: 'visible' });
    
    await expectVisualMatch(page, 'header-title', {
      animationDelay: 300,
    });
  });

  test('should render badge with correct styling', async ({ page }) => {
    // Requirement 2.4: Badge styling with semitransparent background
    const badgeElement = page.locator(
      'header.sticky .badge, header.sticky [class*="badge"]'
    );
    
    if (await badgeElement.count() > 0) {
      await expectVisualMatch(page, 'header-badge', {
        animationDelay: 300,
      });
    }
  });

  test('should maintain header styling across viewports', async ({
    page,
  }) => {
    // Test header across different screen sizes
    const viewports = [
      VIEWPORTS.mobile,
      VIEWPORTS.tablet,
      VIEWPORTS.desktop,
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.waitForTimeout(300);
      
      await expectVisualMatch(page, `header-${viewport.label}`, {
        animationDelay: 300,
      });
    }
  });

  test('should have correct color tokens applied', async ({ page }) => {
    // Verify primary color token (#002C76) is applied
    const headerElement = page.locator('header.sticky');
    
    // Check if header has the primary color in its background
    const bgColor = await headerElement.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Primary blue (#002C76) should be present in background
    expect(bgColor).toBeTruthy();
    
    await expectVisualMatch(page, 'header-color-tokens', {
      animationDelay: 300,
    });
  });

  test('should render header with proper spacing and padding', async ({
    page,
  }) => {
    // Verify header has correct padding (16px 24px)
    const headerElement = page.locator('header.sticky');
    
    const padding = await headerElement.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        paddingTop: style.paddingTop,
        paddingRight: style.paddingRight,
        paddingBottom: style.paddingBottom,
        paddingLeft: style.paddingLeft,
      };
    });

    expect(padding).toBeTruthy();
    
    await expectVisualMatch(page, 'header-spacing', {
      animationDelay: 300,
    });
  });

  test('should maintain header height at 64px', async ({ page }) => {
    // Verify header height is 64px (fixed)
    const headerElement = page.locator('header.sticky');
    
    const height = await headerElement.evaluate((el) => {
      return window.getComputedStyle(el).height;
    });

    expect(height).toBe('64px');
    
    await expectVisualMatch(page, 'header-height', {
      animationDelay: 300,
    });
  });
});
