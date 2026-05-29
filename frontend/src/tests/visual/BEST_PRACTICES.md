# Visual Regression Testing Best Practices

This guide provides best practices for writing and maintaining visual regression tests.

## Test Organization

### File Structure

```
src/tests/visual/
├── __screenshots__/          # Baseline snapshots
│   ├── header.visual.test.ts/
│   │   ├── header-base-state.png
│   │   ├── header-sticky-shadow.png
│   │   └── header-mobile.png
│   ├── card.visual.test.ts/
│   │   ├── card-entity-base.png
│   │   ├── card-entity-hover.png
│   │   └── card-entity-mobile.png
│   └── ...
├── utils.ts                  # Shared utilities
├── header.visual.test.ts     # Header tests
├── card.visual.test.ts       # Card tests
├── button.visual.test.ts     # Button tests
├── badge.visual.test.ts      # Badge tests
├── sidebar.visual.test.ts    # Sidebar tests
├── table.visual.test.ts      # Table tests
├── modal.visual.test.ts      # Modal tests
├── README.md                 # Framework documentation
├── CONFIGURATION.md          # Configuration guide
├── CI_CD_INTEGRATION.md      # CI/CD setup
└── BEST_PRACTICES.md         # This file
```

### Test File Naming

- Use `.visual.test.ts` suffix for visual regression tests
- Use descriptive names: `component-name.visual.test.ts`
- Group related tests in the same file

### Screenshot Naming

- Use descriptive names: `component-state-viewport.png`
- Include state: `base`, `hover`, `active`, `disabled`, `focus`
- Include viewport: `mobile`, `tablet`, `desktop`
- Examples:
  - `button-primary-base-state.png`
  - `button-primary-hover-state.png`
  - `button-primary-mobile.png`
  - `card-entity-hover-desktop.png`

## Test Writing

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';
import {
  expectVisualMatch,
  expectHoverVisualMatch,
  VIEWPORTS,
  waitForElementStable,
} from './utils';

/**
 * Visual Regression Tests for Component Name
 * 
 * Tests the Component across different states and viewports
 * to ensure visual consistency and design compliance.
 * 
 * Validates: Requirements X.X, X.X, X.X
 */
test.describe('Component Name - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to page with component
    await page.goto('/');
    // Wait for component to be stable
    await waitForElementStable(page, '.component-selector');
  });

  test('should render component with correct styling', async ({ page }) => {
    // Test description
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

### Wait for Stability

Always wait for elements to be stable before taking screenshots:

```typescript
// Good: Wait for element and network
await waitForElementStable(page, '.component');

// Good: Wait for animations
await page.waitForTimeout(500);

// Good: Wait for specific condition
await page.waitForFunction(() => {
  const el = document.querySelector('.component');
  return el && el.offsetHeight > 0;
});

// Bad: No wait
await expectVisualMatch(page, 'component');
```

### Use Meaningful Names

```typescript
// Good: Descriptive names
await expectVisualMatch(page, 'button-primary-hover-state');
await expectVisualMatch(page, 'card-entity-mobile-viewport');

// Bad: Generic names
await expectVisualMatch(page, 'test1');
await expectVisualMatch(page, 'screenshot');
```

### Test Key States

```typescript
test.describe('Button Component', () => {
  test('should render base state', async ({ page }) => {
    // Base state
    await expectVisualMatch(page, 'button-base');
  });

  test('should render hover state', async ({ page }) => {
    // Hover state
    await expectHoverVisualMatch(page, 'button', 'button');
  });

  test('should render active state', async ({ page }) => {
    // Active state
    await expectClickVisualMatch(page, 'button', 'button');
  });

  test('should render focus state', async ({ page }) => {
    // Focus state
    await expectFocusVisualMatch(page, 'button', 'button');
  });

  test('should render disabled state', async ({ page }) => {
    // Disabled state
    const button = page.locator('button:disabled');
    await expectVisualMatch(page, 'button-disabled');
  });
});
```

### Test Responsive Design

```typescript
test('should render across all breakpoints', async ({ page }) => {
  const viewports = [
    VIEWPORTS.mobile,
    VIEWPORTS.tablet,
    VIEWPORTS.desktop,
    VIEWPORTS.wide,
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
```

### Test Interactive States

```typescript
test('should handle user interactions', async ({ page }) => {
  // Hover
  await expectHoverVisualMatch(page, '.component', 'component-hover');

  // Click
  await expectClickVisualMatch(page, '.component', 'component-click');

  // Focus
  await expectFocusVisualMatch(page, '.component', 'component-focus');

  // Scroll
  await expectScrollVisualMatch(page, '.component', 'component-scroll');
});
```

## Threshold Management

### Choosing Appropriate Thresholds

```typescript
// Strict comparison (0% difference)
// Use for: Critical UI elements, brand colors, typography
await expectVisualMatch(page, 'component-strict', {
  threshold: 0,
  maxDiffPixels: 0,
});

// Standard comparison (20% difference)
// Use for: Most components, default setting
await expectVisualMatch(page, 'component-standard', {
  threshold: 0.2,
  maxDiffPixels: 100,
});

// Lenient comparison (50% difference)
// Use for: Complex layouts, animations, dynamic content
await expectVisualMatch(page, 'component-lenient', {
  threshold: 0.5,
  maxDiffPixels: 1000,
});
```

### Per-Component Thresholds

```typescript
// Header: Strict (brand critical)
await expectVisualMatch(page, 'header', {
  threshold: 0,
  maxDiffPixels: 0,
});

// Card: Standard (common component)
await expectVisualMatch(page, 'card', {
  threshold: 0.2,
  maxDiffPixels: 100,
});

// Chart: Lenient (dynamic content)
await expectVisualMatch(page, 'chart', {
  threshold: 0.5,
  maxDiffPixels: 1000,
});
```

## Baseline Management

### Creating Baselines

```bash
# Create baselines for all tests
npx playwright test

# Create baselines for specific file
npx playwright test src/tests/visual/header.visual.test.ts

# Create baselines for specific browser
npx playwright test --project=chromium
```

### Updating Baselines

```bash
# Update all baselines
npx playwright test --update-snapshots

# Update specific file
npx playwright test src/tests/visual/header.visual.test.ts --update-snapshots

# Update specific test
npx playwright test -g "should render header" --update-snapshots
```

### Reviewing Changes

```bash
# View HTML report
npx playwright show-report

# View specific test results
npx playwright show-report playwright-report
```

### Committing Baselines

```bash
# Review changes
git diff src/tests/visual/__screenshots__/

# Stage baselines
git add src/tests/visual/__screenshots__/

# Commit with descriptive message
git commit -m "Update visual regression baselines for header component"
```

## Maintenance

### Regular Baseline Updates

- Review baseline changes regularly
- Update baselines when UI changes intentionally
- Document why baselines changed
- Get team approval before committing

### Handling Flaky Tests

```typescript
// Increase animation delay for flaky animations
await expectVisualMatch(page, 'component', {
  animationDelay: 1000, // Increase from 500ms
});

// Increase threshold for flaky rendering
await expectVisualMatch(page, 'component', {
  threshold: 0.3, // Increase from 0.2
});

// Wait for specific condition
await page.waitForFunction(() => {
  const el = document.querySelector('.component');
  return el && el.offsetHeight > 0;
});
```

### Debugging Failed Tests

```bash
# Run test in debug mode
npx playwright test --debug

# Run test in headed mode
npx playwright test --headed

# Run test with trace
npx playwright test --trace on

# View trace
npx playwright show-trace trace.zip
```

## Performance

### Optimize Test Speed

```typescript
// Use parallel execution
workers: 4,

// Reduce animation delays
animationDelay: 100,

// Disable video/trace
video: 'off',
trace: 'off',

// Use selective testing
test.only('critical test', async ({ page }) => {
  // Only run this test
});
```

### Optimize for Reliability

```typescript
// Increase retries
retries: 3,

// Reduce parallel workers
workers: 1,

// Enable video/trace
video: 'on',
trace: 'on',

// Increase timeouts
timeout: 60 * 1000,
```

## Accessibility

### Validate Contrast

```typescript
import { validateContrast } from './utils';

test('should have sufficient contrast', async ({ page }) => {
  const hasContrast = await validateContrast(page, '.component', 4.5);
  expect(hasContrast).toBe(true);
});
```

### Validate Responsive

```typescript
test('should be responsive', async ({ page }) => {
  const dimensions = await validateResponsiveDimensions(
    page,
    '.component',
    [VIEWPORTS.mobile, VIEWPORTS.tablet, VIEWPORTS.desktop]
  );
  
  // Verify dimensions are reasonable
  expect(dimensions.mobile.width).toBeLessThan(dimensions.desktop.width);
});
```

## Documentation

### Document Test Purpose

```typescript
/**
 * Visual Regression Tests for Header Component
 * 
 * Tests the Header component across different states and viewports
 * to ensure visual consistency and design compliance.
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 * 
 * Coverage:
 * - Base state with gradient background
 * - Sticky state with shadow
 * - Title contrast validation
 * - Badge styling
 * - Responsive design (mobile, tablet, desktop)
 */
test.describe('Header Component - Visual Regression', () => {
  // ...
});
```

### Document Test Cases

```typescript
test('should render header with correct gradient background', async ({
  page,
}) => {
  // Requirement 2.1: Header gradient background using primary color tokens
  // Expected: Header displays gradient from primary blue (#002C76) to lighter shade
  // Validates: Color token application, visual hierarchy
  await expectVisualMatch(page, 'header-base-state', {
    animationDelay: 300,
  });
});
```

## Common Pitfalls

### ❌ Don't: Take screenshots without waiting

```typescript
// Bad: No wait for stability
await page.goto('/');
await expectVisualMatch(page, 'component');
```

### ✅ Do: Wait for elements to be stable

```typescript
// Good: Wait for element and network
await page.goto('/');
await waitForElementStable(page, '.component');
await expectVisualMatch(page, 'component');
```

### ❌ Don't: Use generic screenshot names

```typescript
// Bad: Generic names
await expectVisualMatch(page, 'test1');
await expectVisualMatch(page, 'screenshot');
```

### ✅ Do: Use descriptive names

```typescript
// Good: Descriptive names
await expectVisualMatch(page, 'button-primary-hover-state');
await expectVisualMatch(page, 'card-entity-mobile-viewport');
```

### ❌ Don't: Test too many things in one test

```typescript
// Bad: Testing multiple things
test('should render component', async ({ page }) => {
  await expectVisualMatch(page, 'component-base');
  await expectHoverVisualMatch(page, '.component', 'component');
  await expectClickVisualMatch(page, '.component', 'component');
  // Too many assertions
});
```

### ✅ Do: Test one thing per test

```typescript
// Good: Focused tests
test('should render base state', async ({ page }) => {
  await expectVisualMatch(page, 'component-base');
});

test('should render hover state', async ({ page }) => {
  await expectHoverVisualMatch(page, '.component', 'component');
});

test('should render click state', async ({ page }) => {
  await expectClickVisualMatch(page, '.component', 'component');
});
```

### ❌ Don't: Ignore flaky tests

```typescript
// Bad: Ignoring flaky tests
test.skip('flaky test', async ({ page }) => {
  // Skipped indefinitely
});
```

### ✅ Do: Fix flaky tests

```typescript
// Good: Fix the root cause
test('flaky test', async ({ page }) => {
  // Increase animation delay
  await expectVisualMatch(page, 'component', {
    animationDelay: 1000,
  });
});
```

## Resources

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Visual Comparisons](https://playwright.dev/docs/test-snapshots)
- [Debugging Tests](https://playwright.dev/docs/debug)
- [CI/CD Integration](https://playwright.dev/docs/ci)
