# Visual Regression Testing Framework

This directory contains the visual regression testing framework for the UI Color Design Improvement feature. It uses Playwright to capture and compare component screenshots across different browsers, viewports, and interactive states.

## Overview

Visual regression testing ensures that UI changes don't introduce unintended visual regressions. This framework:

- **Captures baseline snapshots** of all components
- **Compares new screenshots** against baselines
- **Tests across multiple browsers** (Chromium, Firefox, WebKit)
- **Tests across multiple viewports** (mobile, tablet, desktop)
- **Validates interactive states** (hover, focus, click)
- **Validates color contrast** (WCAG 2.2 AA compliance)
- **Monitors animation performance**
- **Generates comprehensive reports**

## Setup

### Installation

The project already has Playwright installed. To ensure all dependencies are available:

```bash
npm install
```

### Configuration

The framework is configured in `playwright.config.ts` with:

- **Test directory**: `src/tests/visual/`
- **Test pattern**: `**/*.visual.test.ts`
- **Browsers**: Chromium, Firefox, WebKit
- **Viewports**: Desktop, Tablet, Mobile (including iPad and iPhone)
- **Reporters**: HTML, JSON, JUnit XML
- **Retries**: 2 on CI, 0 locally
- **Timeout**: 30 seconds per test

## Running Tests

### Run all visual regression tests

```bash
npm run test:visual
```

### Run tests in UI mode (interactive)

```bash
npm run test:visual:ui
```

### Run tests in headed mode (see browser)

```bash
npm run test:visual:headed
```

### Run tests for a specific file

```bash
npx playwright test src/tests/visual/header.visual.test.ts
```

### Run tests for a specific browser

```bash
npx playwright test --project=chromium
```

### Update baseline snapshots

When you intentionally change the UI and want to update baselines:

```bash
npx playwright test --update-snapshots
```

## Test Structure

Each visual regression test file follows this pattern:

```typescript
import { test, expect } from '@playwright/test';
import {
  expectVisualMatch,
  expectHoverVisualMatch,
  VIEWPORTS,
  waitForElementStable,
} from './utils';

test.describe('Component Name - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to page with component
    await page.goto('/');
    // Wait for component to be stable
    await waitForElementStable(page, '.component-selector');
  });

  test('should render component with correct styling', async ({ page }) => {
    // Take screenshot and compare with baseline
    await expectVisualMatch(page, 'component-base-state', {
      animationDelay: 300,
    });
  });

  test('should apply hover state correctly', async ({ page }) => {
    // Test hover state
    await expectHoverVisualMatch(page, '.component-selector', 'component', {
      animationDelay: 500,
    });
  });

  test('should render across viewports', async ({ page }) => {
    // Test responsive design
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
      
      await expectVisualMatch(page, `component-${viewport.label}`, {
        animationDelay: 300,
      });
    }
  });
});
```

## Utility Functions

### Screenshot Comparison

- **`expectVisualMatch(page, name, options)`** - Take screenshot and compare with baseline
- **`expectHoverVisualMatch(page, selector, name, options)`** - Test hover state
- **`expectClickVisualMatch(page, selector, name, options)`** - Test click state
- **`expectFocusVisualMatch(page, selector, name, options)`** - Test focus state
- **`expectScrollVisualMatch(page, selector, name, options)`** - Test scroll state
- **`expectFullPageVisualMatch(page, name, options)`** - Full page screenshot

### Element Utilities

- **`waitForElementStable(page, selector)`** - Wait for element to be visible and stable
- **`setViewport(page, width, height)`** - Set viewport size
- **`testAcrossViewports(page, url, name, viewports)`** - Test across multiple viewports

### Validation Utilities

- **`validateContrast(page, selector, minRatio)`** - Validate WCAG 2.2 AA contrast ratio
- **`validateElementProperty(page, selector, property, expectedValue)`** - Validate CSS property
- **`validateResponsiveDimensions(page, selector, viewports)`** - Compare dimensions across viewports
- **`validateAnimationPerformance(page, selector, animationName)`** - Validate animation

### Helper Functions

- **`waitForColor(page, selector, color)`** - Wait for specific color
- **`getComputedStyle(page, selector, property)`** - Get computed CSS property
- **`waitForVisualStability(page, timeout)`** - Wait for layout stability

## Viewport Sizes

The framework includes predefined viewport sizes:

```typescript
VIEWPORTS = {
  mobile: { width: 375, height: 667, label: 'mobile' },      // iPhone SE
  tablet: { width: 768, height: 1024, label: 'tablet' },     // iPad
  desktop: { width: 1440, height: 900, label: 'desktop' },   // Standard desktop
  wide: { width: 1920, height: 1080, label: 'wide' },        // Full HD
}
```

## Baseline Snapshots

Baseline snapshots are stored in `src/tests/visual/__screenshots__/` directory. Each test generates a screenshot file named `{testName}.png`.

### Creating Baselines

When running tests for the first time, baselines are automatically created:

```bash
npx playwright test
```

### Updating Baselines

When you intentionally change the UI:

```bash
npx playwright test --update-snapshots
```

### Reviewing Changes

After updating baselines, review the changes:

```bash
npx playwright show-report
```

## CI/CD Integration

### GitHub Actions

Add to `.github/workflows/test.yml`:

```yaml
- name: Run visual regression tests
  run: npm run test:visual
  
- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

### Environment Variables

- `CI=true` - Enables CI mode (retries, parallel workers)
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` - Skip browser download in CI

## Test Results

### HTML Report

After running tests, view the HTML report:

```bash
npx playwright show-report
```

### JSON Report

Test results are saved to `test-results/results.json` for CI integration.

### JUnit Report

JUnit XML report is saved to `test-results/junit.xml` for CI integration.

## Troubleshooting

### Tests fail with "Timeout"

- Increase timeout in `playwright.config.ts`
- Check if dev server is running: `npm run dev`
- Verify network connectivity

### Baseline mismatch

- Review the diff in the HTML report
- If changes are intentional, update baselines: `npx playwright test --update-snapshots`
- If changes are unintentional, fix the code

### Screenshots are blurry

- Ensure animations are complete before taking screenshots
- Increase `animationDelay` in test options
- Check device pixel ratio settings

### Tests fail on CI but pass locally

- Ensure CI environment matches local environment
- Check for timing issues (use `waitForElementStable`)
- Verify browser versions are consistent

## Best Practices

1. **Wait for stability** - Always use `waitForElementStable()` before taking screenshots
2. **Use meaningful names** - Name screenshots descriptively (e.g., `button-hover-state`)
3. **Test key states** - Test base, hover, active, disabled, and focus states
4. **Test responsive** - Always test across mobile, tablet, and desktop
5. **Validate contrast** - Use `validateContrast()` for accessibility
6. **Review changes** - Always review baseline updates before committing
7. **Keep tests focused** - Each test should validate one specific aspect
8. **Use appropriate delays** - Wait for animations to complete (typically 200-500ms)

## Requirements Coverage

This visual regression testing framework validates the following requirements:

- **Requirement 1.1**: Color token consistency across components
- **Requirement 1.5**: Design token application and responsiveness
- **Requirement 2.1**: Header gradient background and styling
- **Requirement 2.2**: Header shadow and sticky positioning
- **Requirement 2.3**: Header title contrast and visibility
- **Requirement 2.4**: Header badge styling
- **Requirement 3.1**: Card and panel base styling
- **Requirement 3.2**: Card hover state and transitions
- **Requirement 3.4**: Card border-radius and shadow
- **Requirement 3.5**: Panel hover state and transitions
- **Requirement 4.1**: Button primary styling
- **Requirement 4.2**: Button hover and active states
- **Requirement 4.3**: Button green variant
- **Requirement 4.4**: Ghost button styling
- **Requirement 4.5**: Ghost button hover state
- **Requirement 4.6**: Button green variant styling
- **Requirement 5.1**: Severity chip styling
- **Requirement 5.2**: Severity chip high level
- **Requirement 5.3**: Severity chip medium level
- **Requirement 5.4**: Status badge approved
- **Requirement 5.5**: Status badge failed
- **Requirement 5.6**: Status badge pending
- **Requirement 5.7**: Severity chip visual distinction
- **Requirement 6.1**: Sidebar styling
- **Requirement 6.2**: Sidebar link hover state
- **Requirement 6.3**: Sidebar link styling
- **Requirement 6.4**: Sidebar sticky positioning
- **Requirement 7.1**: Table header styling
- **Requirement 7.2**: Table row alternating backgrounds
- **Requirement 7.3**: Table row hover state
- **Requirement 7.4**: Table cell styling
- **Requirement 8.1**: Modal container styling
- **Requirement 8.2**: Modal entry animation
- **Requirement 8.3**: Modal overlay styling
- **Requirement 10.1**: Responsive design mobile
- **Requirement 10.2**: Responsive design tablet
- **Requirement 10.3**: Responsive design desktop
- **Requirement 10.4**: Responsive design modal

## Next Steps

1. Run the existing visual regression tests to create baselines
2. Review the baseline snapshots in the HTML report
3. Integrate visual regression tests into CI/CD pipeline
4. Create additional tests for new components as needed
5. Monitor test results and update baselines when UI changes intentionally

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Visual Comparisons](https://playwright.dev/docs/test-snapshots)
- [Reporters](https://playwright.dev/docs/test-reporters)
- [CI/CD Integration](https://playwright.dev/docs/ci)
