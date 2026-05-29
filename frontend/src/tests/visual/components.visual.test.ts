import { test, expect } from '@playwright/test';
import { VIEWPORTS, expectVisualMatch, setViewport } from './utils';

const buildFixture = () => `
  <main style="padding:24px;background:#f8fafc">
    <section style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
      <button class="report-action-btn" id="primary-btn">Primario</button>
      <button class="report-action-btn report-action-btn-green" id="green-btn">Verde</button>
      <button class="report-ghost-btn" id="ghost-btn">Ghost</button>
    </section>
    <section style="display:flex;gap:8px;margin-bottom:16px">
      <span class="report-severity-chip report-sev-high">alto</span>
      <span class="report-severity-chip report-sev-medium">medio</span>
      <span class="report-severity-chip report-sev-low">bajo</span>
      <span class="report-status-badge report-status-approved">approved</span>
      <span class="report-status-badge report-status-failed">failed</span>
      <span class="report-status-badge report-status-pending">pending</span>
    </section>
    <section class="report-shell" style="margin-bottom:16px">
      <aside class="report-sidebar" style="display:flex;width:256px">
        <a href="#a" class="report-side-link">Score</a>
      </aside>
      <div class="report-panel">Panel</div>
    </section>
    <section class="report-panel report-panel-spacious" style="margin-bottom:16px">
      <table class="report-table report-table-spacious" style="width:100%">
        <thead><tr><th>Criterio</th><th>Nivel</th></tr></thead>
        <tbody><tr class="report-row-hover"><td>1.1.1</td><td><span class="report-severity-chip report-sev-high">alto</span></td></tr></tbody>
      </table>
    </section>
    <div class="report-modal-overlay" style="position:relative;inset:auto;display:flex">
      <div class="report-modal" style="position:relative">
        <h3 class="report-section-title">Modal</h3>
      </div>
    </div>
  </main>
`;

test.describe('Remaining Components - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate((html) => {
      document.body.innerHTML = html;
    }, buildFixture());
  });

  test('should render buttons, badges, sidebar, table and modal across breakpoints', async ({ page }) => {
    for (const viewport of [VIEWPORTS.mobile, VIEWPORTS.tablet, VIEWPORTS.desktop]) {
      await setViewport(page, viewport.width, viewport.height);
      await expectVisualMatch(page, `remaining-components-${viewport.label}`, { fullPage: true });
    }
  });

  test('should render interactive hover and active states', async ({ page }) => {
    await setViewport(page, VIEWPORTS.desktop.width, VIEWPORTS.desktop.height);
    await page.locator('#primary-btn').hover();
    await page.mouse.down();
    await expectVisualMatch(page, 'remaining-components-primary-active');
    await page.mouse.up();
    await page.locator('#ghost-btn').hover();
    await page.locator('.report-side-link').hover();
    await page.locator('.report-row-hover').hover();
    await expectVisualMatch(page, 'remaining-components-hover-states');
  });

  test('should keep modal and table readable on tablet', async ({ page }) => {
    await setViewport(page, VIEWPORTS.tablet.width, VIEWPORTS.tablet.height);
    const modal = page.locator('.report-modal');
    const table = page.locator('.report-table');
    await expect(modal).toBeVisible();
    await expect(table).toBeVisible();
    await expectVisualMatch(page, 'remaining-components-tablet-readability');
  });
});
