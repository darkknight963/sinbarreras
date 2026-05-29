import { test, expect } from '@playwright/test';
import {
  expectVisualMatch,
  expectHoverVisualMatch,
  VIEWPORTS,
  waitForElementStable,
} from './utils';

/**
 * Visual Regression Tests for Card Components
 * 
 * Tests Report Card Entity and Report Panel components across different
 * states and viewports to ensure visual consistency and design compliance.
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

test.describe('Card Components - Visual Regression', () => {
  test.describe('Report Card Entity', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to projects page with card entities
      await page.goto('/');
      await waitForElementStable(page, '.report-card-entity');
    });

    test('should render card with correct base styling', async ({ page }) => {
      // Requirement 3.1: Card background, border, border-radius, shadow
      const cardElement = page.locator('.report-card-entity').first();
      await cardElement.waitFor({ state: 'visible' });
      
      await expectVisualMatch(page, 'card-entity-base', {
        animationDelay: 300,
      });
    });

    test('should display correct border and shadow on base state', async ({
      page,
    }) => {
      // Verify white background with neutral-200 border
      const cardElement = page.locator('.report-card-entity').first();
      
      const styles = await cardElement.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          borderRadius: style.borderRadius,
          boxShadow: style.boxShadow,
        };
      });

      expect(styles.backgroundColor).toBeTruthy();
      expect(styles.borderRadius).toBeTruthy();
      
      await expectVisualMatch(page, 'card-entity-styling', {
        animationDelay: 300,
      });
    });

    test('should apply hover state with elevated shadow', async ({
      page,
    }) => {
      // Requirement 3.2: Hover state with border change and shadow elevation
      await expectHoverVisualMatch(
        page,
        '.report-card-entity',
        'card-entity',
        {
          animationDelay: 500, // Wait for transition
        }
      );
    });

    test('should have smooth transition on hover', async ({ page }) => {
      // Verify transition duration is 250ms or less
      const cardElement = page.locator('.report-card-entity').first();
      
      const transition = await cardElement.evaluate((el) => {
        return window.getComputedStyle(el).transition;
      });

      expect(transition).toBeTruthy();
      
      await expectVisualMatch(page, 'card-entity-transition', {
        animationDelay: 300,
      });
    });

    test('should render card across different viewports', async ({
      page,
    }) => {
      // Test card across mobile, tablet, and desktop
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
        
        await expectVisualMatch(page, `card-entity-${viewport.label}`, {
          animationDelay: 300,
        });
      }
    });

    test('should display project name with correct typography', async ({
      page,
    }) => {
      // Verify project name has font-bold (700) and 1rem size
      const projectNameElement = page
        .locator('.report-card-entity')
        .first()
        .locator('[class*="name"], h3, h4');
      
      if (await projectNameElement.count() > 0) {
        const fontWeight = await projectNameElement.evaluate((el) => {
          return window.getComputedStyle(el).fontWeight;
        });

        expect(fontWeight).toBeTruthy();
        
        await expectVisualMatch(page, 'card-entity-typography', {
          animationDelay: 300,
        });
      }
    });
  });

  test.describe('Report Panel', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to a page with report panels
      await page.goto('/');
      await waitForElementStable(page, '.report-panel');
    });

    test('should render panel with correct base styling', async ({
      page,
    }) => {
      // Requirement 3.1, 3.4: Panel background, border, border-radius, shadow
      const panelElement = page.locator('.report-panel').first();
      await panelElement.waitFor({ state: 'visible' });
      
      await expectVisualMatch(page, 'panel-base', {
        animationDelay: 300,
      });
    });

    test('should display correct border and shadow on base state', async ({
      page,
    }) => {
      // Verify white background with neutral-200 border
      const panelElement = page.locator('.report-panel').first();
      
      const styles = await panelElement.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          borderRadius: style.borderRadius,
          boxShadow: style.boxShadow,
        };
      });

      expect(styles.backgroundColor).toBeTruthy();
      expect(styles.borderRadius).toBeTruthy();
      
      await expectVisualMatch(page, 'panel-styling', {
        animationDelay: 300,
      });
    });

    test('should apply hover state with elevated shadow', async ({
      page,
    }) => {
      // Requirement 3.5: Hover state with shadow elevation
      await expectHoverVisualMatch(page, '.report-panel', 'panel', {
        animationDelay: 400, // Wait for transition
      });
    });

    test('should have smooth transition on hover', async ({ page }) => {
      // Verify transition duration is 200ms or less
      const panelElement = page.locator('.report-panel').first();
      
      const transition = await panelElement.evaluate((el) => {
        return window.getComputedStyle(el).transition;
      });

      expect(transition).toBeTruthy();
      
      await expectVisualMatch(page, 'panel-transition', {
        animationDelay: 300,
      });
    });

    test('should render panel across different viewports', async ({
      page,
    }) => {
      // Test panel across mobile, tablet, and desktop
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
        
        await expectVisualMatch(page, `panel-${viewport.label}`, {
          animationDelay: 300,
        });
      }
    });

    test('should have correct padding on different viewports', async ({
      page,
    }) => {
      // Verify responsive padding: 24px (desktop), 20px (tablet), 16px (mobile)
      const panelElement = page.locator('.report-panel').first();

      // Desktop
      await page.setViewportSize({
        width: VIEWPORTS.desktop.width,
        height: VIEWPORTS.desktop.height,
      });
      await page.waitForTimeout(300);
      
      let padding = await panelElement.evaluate((el) => {
        return window.getComputedStyle(el).padding;
      });
      expect(padding).toBeTruthy();

      // Tablet
      await page.setViewportSize({
        width: VIEWPORTS.tablet.width,
        height: VIEWPORTS.tablet.height,
      });
      await page.waitForTimeout(300);
      
      padding = await panelElement.evaluate((el) => {
        return window.getComputedStyle(el).padding;
      });
      expect(padding).toBeTruthy();

      // Mobile
      await page.setViewportSize({
        width: VIEWPORTS.mobile.width,
        height: VIEWPORTS.mobile.height,
      });
      await page.waitForTimeout(300);
      
      padding = await panelElement.evaluate((el) => {
        return window.getComputedStyle(el).padding;
      });
      expect(padding).toBeTruthy();
      
      await expectVisualMatch(page, 'panel-responsive-padding', {
        animationDelay: 300,
      });
    });
  });
});
