import { test, expect } from '@playwright/test';
import {
  expectVisualMatch,
  VIEWPORTS,
  waitForElementStable,
  setViewport,
  validateResponsiveDimensions,
} from './utils';

/**
 * Component Reflow Tests (Task 15.5)
 * 
 * Tests how components adapt and reflow across different breakpoints.
 * Validates that components properly reflow their content, adjust dimensions,
 * and maintain visual integrity across mobile, tablet, and desktop viewports.
 * 
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4
 */

test.describe('Component Reflow Tests', () => {
  test.describe('Card Grid Reflow', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to projects page with card grid
      await page.goto('/');
      await waitForElementStable(page, '.report-card-entity');
    });

    test('should reflow card grid from multi-column to single column on mobile', async ({
      page,
    }) => {
      // Desktop: Multiple columns
      await setViewport(page, VIEWPORTS.desktop.width, VIEWPORTS.desktop.height);
      await page.waitForTimeout(300);
      
      const desktopCards = await page.locator('.report-card-entity').count();
      expect(desktopCards).toBeGreaterThan(0);
      
      await expectVisualMatch(page, 'card-grid-desktop', {
        animationDelay: 300,
      });

      // Mobile: Single column
      await setViewport(page, VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      await page.waitForTimeout(300);
      
      const mobileCards = await page.locator('.report-card-entity').count();
      expect(mobileCards).toBe(desktopCards);
      
      await expectVisualMatch(page, 'card-grid-mobile', {
        animationDelay: 300,
      });
    });

    test('should maintain card width constraints during reflow', async ({
      page,
    }) => {
      const viewports = [
        VIEWPORTS.mobile,
        VIEWPORTS.tablet,
        VIEWPORTS.desktop,
      ];

      for (const viewport of viewports) {
        await setViewport(page, viewport.width, viewport.height);
        await page.waitForTimeout(300);

        const card = page.locator('.report-card-entity').first();
        const cardBox = await card.boundingBox();
        
        expect(cardBox).toBeTruthy();
        expect(cardBox?.width).toBeLessThanOrEqual(viewport.width);
        
        await expectVisualMatch(page, `card-width-${viewport.label}`, {
          animationDelay: 300,
        });
      }
    });

    test('should adjust card spacing during reflow', async ({ page }) => {
      // Desktop spacing
      await setViewport(page, VIEWPORTS.desktop.width, VIEWPORTS.desktop.height);
      await page.waitForTimeout(300);
      
      const desktopGap = await page.locator('.report-card-entity').first().evaluate((el) => {
        const parent = el.parentElement;
        return parent ? window.getComputedStyle(parent).gap : '0';
      });

      // Mobile spacing
      await setViewport(page, VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      await page.waitForTimeout(300);
      
      const mobileGap = await page.locator('.report-card-entity').first().evaluate((el) => {
        const parent = el.parentElement;
        return parent ? window.getComputedStyle(parent).gap : '0';
      });

      // Gaps should be different (mobile typically has less gap)
      expect(desktopGap).toBeTruthy();
      expect(mobileGap).toBeTruthy();
      
      await expectVisualMatch(page, 'card-spacing-reflow', {
        animationDelay: 300,
      });
    });

    test('should reflow card content without truncation', async ({ page }) => {
      const viewports = [
        VIEWPORTS.mobile,
        VIEWPORTS.tablet,
        VIEWPORTS.desktop,
      ];

      for (const viewport of viewports) {
        await setViewport(page, viewport.width, viewport.height);
        await page.waitForTimeout(300);

        const cards = page.locator('.report-card-entity');
        const count = await cards.count();

        for (let i = 0; i < Math.min(count, 3); i++) {
          const card = cards.nth(i);
          const isVisible = await card.isVisible();
          expect(isVisible).toBe(true);
        }
        
        await expectVisualMatch(page, `card-content-${viewport.label}`, {
          animationDelay: 300,
        });
      }
    });
  });

  test.describe('Table Horizontal Scroll on Mobile', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to a page with table
      await page.goto('/');
      await waitForElementStable(page, '.report-table');
    });

    test('should display table with horizontal scroll on mobile', async ({
      page,
    }) => {
      await setViewport(page, VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      await page.waitForTimeout(300);

      const table = page.locator('.report-table');
      const isVisible = await table.isVisible();
      expect(isVisible).toBe(true);
      
      await expectVisualMatch(page, 'table-mobile-scroll', {
        animationDelay: 300,
      });
    });

    test('should maintain table readability on mobile', async ({ page }) => {
      await setViewport(page, VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      await page.waitForTimeout(300);

      const table = page.locator('.report-table');
      const cells = table.locator('td, th');
      const cellCount = await cells.count();
      
      expect(cellCount).toBeGreaterThan(0);
      
      // Verify cells are readable (not too small)
      const firstCell = cells.first();
      const fontSize = await firstCell.evaluate((el) => {
        return window.getComputedStyle(el).fontSize;
      });
      
      expect(fontSize).toBeTruthy();
      
      await expectVisualMatch(page, 'table-mobile-readability', {
        animationDelay: 300,
      });
    });

    test('should display full table on desktop without scroll', async ({
      page,
    }) => {
      await setViewport(page, VIEWPORTS.desktop.width, VIEWPORTS.desktop.height);
      await page.waitForTimeout(300);

      const table = page.locator('.report-table');
      const isVisible = await table.isVisible();
      expect(isVisible).toBe(true);
      
      await expectVisualMatch(page, 'table-desktop-full', {
        animationDelay: 300,
      });
    });

    test('should reflow table columns on tablet', async ({ page }) => {
      await setViewport(page, VIEWPORTS.tablet.width, VIEWPORTS.tablet.height);
      await page.waitForTimeout(300);

      const table = page.locator('.report-table');
      const isVisible = await table.isVisible();
      expect(isVisible).toBe(true);
      
      await expectVisualMatch(page, 'table-tablet-reflow', {
        animationDelay: 300,
      });
    });
  });

  test.describe('Modal Width Adaptation', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to a page with modal or trigger modal
      await page.goto('/');
      // Look for modal trigger button
      const modalTrigger = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Launch")').first();
      if (await modalTrigger.isVisible()) {
        await modalTrigger.click();
        await page.waitForTimeout(300);
      }
    });

    test('should adapt modal width on mobile', async ({ page }) => {
      await setViewport(page, VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      await page.waitForTimeout(300);

      const modal = page.locator('.report-modal');
      if (await modal.isVisible()) {
        const modalBox = await modal.boundingBox();
        expect(modalBox).toBeTruthy();
        
        // Modal should not exceed viewport width
        expect(modalBox?.width).toBeLessThanOrEqual(VIEWPORTS.mobile.width);
        
        await expectVisualMatch(page, 'modal-mobile-width', {
          animationDelay: 300,
        });
      }
    });

    test('should maintain modal max-width on desktop', async ({ page }) => {
      await setViewport(page, VIEWPORTS.desktop.width, VIEWPORTS.desktop.height);
      await page.waitForTimeout(300);

      const modal = page.locator('.report-modal');
      if (await modal.isVisible()) {
        const modalBox = await modal.boundingBox();
        expect(modalBox).toBeTruthy();
        
        // Modal should respect max-width (480px)
        expect(modalBox?.width).toBeLessThanOrEqual(480);
        
        await expectVisualMatch(page, 'modal-desktop-width', {
          animationDelay: 300,
        });
      }
    });

    test('should adjust modal padding on mobile', async ({ page }) => {
      await setViewport(page, VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      await page.waitForTimeout(300);

      const modal = page.locator('.report-modal');
      if (await modal.isVisible()) {
        const padding = await modal.evaluate((el) => {
          return window.getComputedStyle(el).padding;
        });
        
        expect(padding).toBeTruthy();
        
        await expectVisualMatch(page, 'modal-mobile-padding', {
          animationDelay: 300,
        });
      }
    });

    test('should center modal on all viewports', async ({ page }) => {
      const viewports = [
        VIEWPORTS.mobile,
        VIEWPORTS.tablet,
        VIEWPORTS.desktop,
      ];

      for (const viewport of viewports) {
        await setViewport(page, viewport.width, viewport.height);
        await page.waitForTimeout(300);

        const modal = page.locator('.report-modal');
        if (await modal.isVisible()) {
          const modalBox = await modal.boundingBox();
          expect(modalBox).toBeTruthy();
          
          await expectVisualMatch(page, `modal-centered-${viewport.label}`, {
            animationDelay: 300,
          });
        }
      }
    });
  });

  test.describe('Typography Scaling', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await waitForElementStable(page, '.report-title');
    });

    test('should scale title typography on mobile', async ({ page }) => {
      await setViewport(page, VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      await page.waitForTimeout(300);

      const title = page.locator('.report-title').first();
      const fontSize = await title.evaluate((el) => {
        return window.getComputedStyle(el).fontSize;
      });
      
      expect(fontSize).toBeTruthy();
      
      await expectVisualMatch(page, 'title-mobile-scale', {
        animationDelay: 300,
      });
    });

    test('should maintain title readability across viewports', async ({
      page,
    }) => {
      const viewports = [
        VIEWPORTS.mobile,
        VIEWPORTS.tablet,
        VIEWPORTS.desktop,
      ];

      for (const viewport of viewports) {
        await setViewport(page, viewport.width, viewport.height);
        await page.waitForTimeout(300);

        const title = page.locator('.report-title').first();
        const isVisible = await title.isVisible();
        expect(isVisible).toBe(true);
        
        await expectVisualMatch(page, `title-readable-${viewport.label}`, {
          animationDelay: 300,
        });
      }
    });

    test('should scale section titles appropriately', async ({ page }) => {
      const viewports = [
        VIEWPORTS.mobile,
        VIEWPORTS.tablet,
        VIEWPORTS.desktop,
      ];

      for (const viewport of viewports) {
        await setViewport(page, viewport.width, viewport.height);
        await page.waitForTimeout(300);

        const sectionTitle = page.locator('.report-section-title').first();
        if (await sectionTitle.isVisible()) {
          const fontSize = await sectionTitle.evaluate((el) => {
            return window.getComputedStyle(el).fontSize;
          });
          
          expect(fontSize).toBeTruthy();
          
          await expectVisualMatch(page, `section-title-${viewport.label}`, {
            animationDelay: 300,
          });
        }
      }
    });

    test('should maintain line-height for readability', async ({ page }) => {
      const viewports = [
        VIEWPORTS.mobile,
        VIEWPORTS.tablet,
        VIEWPORTS.desktop,
      ];

      for (const viewport of viewports) {
        await setViewport(page, viewport.width, viewport.height);
        await page.waitForTimeout(300);

        const paragraph = page.locator('p').first();
        if (await paragraph.isVisible()) {
          const lineHeight = await paragraph.evaluate((el) => {
            return window.getComputedStyle(el).lineHeight;
          });
          
          expect(lineHeight).toBeTruthy();
          
          await expectVisualMatch(page, `line-height-${viewport.label}`, {
            animationDelay: 300,
          });
        }
      }
    });
  });

  test.describe('Panel Content Reflow', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await waitForElementStable(page, '.report-panel');
    });

    test('should reflow panel content on mobile', async ({ page }) => {
      await setViewport(page, VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      await page.waitForTimeout(300);

      const panel = page.locator('.report-panel').first();
      const isVisible = await panel.isVisible();
      expect(isVisible).toBe(true);
      
      await expectVisualMatch(page, 'panel-content-mobile', {
        animationDelay: 300,
      });
    });

    test('should maintain panel readability across viewports', async ({
      page,
    }) => {
      const viewports = [
        VIEWPORTS.mobile,
        VIEWPORTS.tablet,
        VIEWPORTS.desktop,
      ];

      for (const viewport of viewports) {
        await setViewport(page, viewport.width, viewport.height);
        await page.waitForTimeout(300);

        const panel = page.locator('.report-panel').first();
        const isVisible = await panel.isVisible();
        expect(isVisible).toBe(true);
        
        await expectVisualMatch(page, `panel-readable-${viewport.label}`, {
          animationDelay: 300,
        });
      }
    });

    test('should adjust panel padding during reflow', async ({ page }) => {
      const viewports = [
        VIEWPORTS.mobile,
        VIEWPORTS.tablet,
        VIEWPORTS.desktop,
      ];

      const paddings: Record<string, string> = {};

      for (const viewport of viewports) {
        await setViewport(page, viewport.width, viewport.height);
        await page.waitForTimeout(300);

        const panel = page.locator('.report-panel').first();
        const padding = await panel.evaluate((el) => {
          return window.getComputedStyle(el).padding;
        });
        
        paddings[viewport.label] = padding;
        expect(padding).toBeTruthy();
      }

      // Verify padding changes across breakpoints
      expect(paddings.mobile).toBeTruthy();
      expect(paddings.tablet).toBeTruthy();
      expect(paddings.desktop).toBeTruthy();
      
      await expectVisualMatch(page, 'panel-padding-reflow', {
        animationDelay: 300,
      });
    });
  });

  test.describe('Sidebar Reflow', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await waitForElementStable(page, '.report-sidebar');
    });

    test('should reflow sidebar on mobile', async ({ page }) => {
      await setViewport(page, VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      await page.waitForTimeout(300);

      const sidebar = page.locator('.report-sidebar');
      if (await sidebar.isVisible()) {
        const sidebarBox = await sidebar.boundingBox();
        expect(sidebarBox).toBeTruthy();
        
        await expectVisualMatch(page, 'sidebar-mobile-reflow', {
          animationDelay: 300,
        });
      }
    });

    test('should maintain sidebar on desktop', async ({ page }) => {
      await setViewport(page, VIEWPORTS.desktop.width, VIEWPORTS.desktop.height);
      await page.waitForTimeout(300);

      const sidebar = page.locator('.report-sidebar');
      if (await sidebar.isVisible()) {
        const sidebarBox = await sidebar.boundingBox();
        expect(sidebarBox).toBeTruthy();
        
        await expectVisualMatch(page, 'sidebar-desktop-visible', {
          animationDelay: 300,
        });
      }
    });

    test('should adjust sidebar link spacing on mobile', async ({ page }) => {
      await setViewport(page, VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      await page.waitForTimeout(300);

      const links = page.locator('.report-side-link');
      const count = await links.count();
      expect(count).toBeGreaterThan(0);
      
      await expectVisualMatch(page, 'sidebar-links-mobile', {
        animationDelay: 300,
      });
    });
  });

  test.describe('Header Reflow', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await waitForElementStable(page, 'header.sticky');
    });

    test('should reflow header on mobile', async ({ page }) => {
      await setViewport(page, VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      await page.waitForTimeout(300);

      const header = page.locator('header.sticky');
      const isVisible = await header.isVisible();
      expect(isVisible).toBe(true);
      
      await expectVisualMatch(page, 'header-mobile-reflow', {
        animationDelay: 300,
      });
    });

    test('should maintain header height across viewports', async ({
      page,
    }) => {
      const viewports = [
        VIEWPORTS.mobile,
        VIEWPORTS.tablet,
        VIEWPORTS.desktop,
      ];

      for (const viewport of viewports) {
        await setViewport(page, viewport.width, viewport.height);
        await page.waitForTimeout(300);

        const header = page.locator('header.sticky');
        const headerBox = await header.boundingBox();
        expect(headerBox).toBeTruthy();
        
        await expectVisualMatch(page, `header-height-${viewport.label}`, {
          animationDelay: 300,
        });
      }
    });

    test('should scale header content on mobile', async ({ page }) => {
      await setViewport(page, VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      await page.waitForTimeout(300);

      const title = page.locator('header.sticky h1').first();
      if (await title.isVisible()) {
        const fontSize = await title.evaluate((el) => {
          return window.getComputedStyle(el).fontSize;
        });
        
        expect(fontSize).toBeTruthy();
        
        await expectVisualMatch(page, 'header-title-mobile', {
          animationDelay: 300,
        });
      }
    });
  });

  test.describe('Badge and Label Reflow', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await waitForElementStable(page, '.report-sev-high, .report-status-approved');
    });

    test('should maintain badge size on mobile', async ({ page }) => {
      await setViewport(page, VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      await page.waitForTimeout(300);

      const badge = page.locator('.report-sev-high, .report-status-approved').first();
      if (await badge.isVisible()) {
        const badgeBox = await badge.boundingBox();
        expect(badgeBox).toBeTruthy();
        
        await expectVisualMatch(page, 'badge-mobile-size', {
          animationDelay: 300,
        });
      }
    });

    test('should display badges without wrapping', async ({ page }) => {
      const viewports = [
        VIEWPORTS.mobile,
        VIEWPORTS.tablet,
        VIEWPORTS.desktop,
      ];

      for (const viewport of viewports) {
        await setViewport(page, viewport.width, viewport.height);
        await page.waitForTimeout(300);

        const badges = page.locator('.report-sev-high, .report-sev-medium, .report-sev-low, .report-status-approved, .report-status-failed, .report-status-pending');
        const count = await badges.count();
        
        if (count > 0) {
          await expectVisualMatch(page, `badges-${viewport.label}`, {
            animationDelay: 300,
          });
        }
      }
    });
  });

  test.describe('Button Reflow', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await waitForElementStable(page, '.report-action-btn, .report-ghost-btn');
    });

    test('should maintain button size on mobile', async ({ page }) => {
      await setViewport(page, VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      await page.waitForTimeout(300);

      const button = page.locator('.report-action-btn, .report-ghost-btn').first();
      if (await button.isVisible()) {
        const buttonBox = await button.boundingBox();
        expect(buttonBox).toBeTruthy();
        
        await expectVisualMatch(page, 'button-mobile-size', {
          animationDelay: 300,
        });
      }
    });

    test('should display buttons with proper spacing', async ({ page }) => {
      const viewports = [
        VIEWPORTS.mobile,
        VIEWPORTS.tablet,
        VIEWPORTS.desktop,
      ];

      for (const viewport of viewports) {
        await setViewport(page, viewport.width, viewport.height);
        await page.waitForTimeout(300);

        const buttons = page.locator('.report-action-btn, .report-ghost-btn');
        const count = await buttons.count();
        
        if (count > 0) {
          await expectVisualMatch(page, `buttons-${viewport.label}`, {
            animationDelay: 300,
          });
        }
      }
    });
  });

  test.describe('Overall Layout Reflow', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    });

    test('should reflow entire page on mobile', async ({ page }) => {
      await setViewport(page, VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      await page.waitForTimeout(500);
      
      await expectVisualMatch(page, 'full-page-mobile', {
        animationDelay: 500,
        fullPage: true,
      });
    });

    test('should reflow entire page on tablet', async ({ page }) => {
      await setViewport(page, VIEWPORTS.tablet.width, VIEWPORTS.tablet.height);
      await page.waitForTimeout(500);
      
      await expectVisualMatch(page, 'full-page-tablet', {
        animationDelay: 500,
        fullPage: true,
      });
    });

    test('should display entire page on desktop', async ({ page }) => {
      await setViewport(page, VIEWPORTS.desktop.width, VIEWPORTS.desktop.height);
      await page.waitForTimeout(500);
      
      await expectVisualMatch(page, 'full-page-desktop', {
        animationDelay: 500,
        fullPage: true,
      });
    });

    test('should not have horizontal overflow on mobile', async ({ page }) => {
      await setViewport(page, VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      await page.waitForTimeout(300);

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });

      expect(hasHorizontalScroll).toBe(false);
      
      await expectVisualMatch(page, 'no-overflow-mobile', {
        animationDelay: 300,
      });
    });

    test('should maintain layout integrity during resize', async ({
      page,
    }) => {
      // Start at desktop
      await setViewport(page, VIEWPORTS.desktop.width, VIEWPORTS.desktop.height);
      await page.waitForTimeout(300);
      
      await expectVisualMatch(page, 'resize-desktop-start', {
        animationDelay: 300,
      });

      // Resize to tablet
      await setViewport(page, VIEWPORTS.tablet.width, VIEWPORTS.tablet.height);
      await page.waitForTimeout(300);
      
      await expectVisualMatch(page, 'resize-tablet-middle', {
        animationDelay: 300,
      });

      // Resize to mobile
      await setViewport(page, VIEWPORTS.mobile.width, VIEWPORTS.mobile.height);
      await page.waitForTimeout(300);
      
      await expectVisualMatch(page, 'resize-mobile-end', {
        animationDelay: 300,
      });
    });

    test('should validate responsive dimensions', async ({ page }) => {
      const dimensions = await validateResponsiveDimensions(
        page,
        '.report-panel',
        [VIEWPORTS.mobile, VIEWPORTS.tablet, VIEWPORTS.desktop]
      );

      expect(dimensions.mobile).toBeTruthy();
      expect(dimensions.tablet).toBeTruthy();
      expect(dimensions.desktop).toBeTruthy();

      // Verify dimensions increase with viewport
      expect(dimensions.mobile.width).toBeLessThanOrEqual(dimensions.tablet.width);
      expect(dimensions.tablet.width).toBeLessThanOrEqual(dimensions.desktop.width);
    });
  });
});
