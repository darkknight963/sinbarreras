# Visual Regression Testing Configuration Guide

This guide explains how to configure and customize the visual regression testing framework.

## Playwright Configuration

The main configuration file is `playwright.config.ts` in the project root.

### Basic Configuration

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory and pattern
  testDir: './src/tests/visual',
  testMatch: '**/*.visual.test.ts',
  
  // Parallel execution
  fullyParallel: true,
  
  // Retries
  retries: process.env.CI ? 2 : 0,
  
  // Workers
  workers: process.env.CI ? 1 : undefined,
  
  // Reporters
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
  ],
  
  // Global settings
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  
  // Projects (browsers)
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  
  // Web server
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  
  // Timeouts
  timeout: 30 * 1000,
  expect: { timeout: 5 * 1000 },
});
```

## Visual Regression Test Options

### Screenshot Comparison Options

```typescript
interface VisualTestOptions {
  // Threshold for pixel difference (0-1)
  // 0 = exact match, 1 = any difference allowed
  // Default: 0.2 (20% difference allowed)
  threshold?: number;
  
  // Maximum number of pixels that can differ
  // Default: 100
  maxDiffPixels?: number;
  
  // Wait time before taking screenshot (ms)
  // Allows animations to complete
  // Default: 500
  animationDelay?: number;
  
  // Viewport size for testing
  viewport?: { width: number; height: number };
  
  // Elements to mask (ignore in comparison)
  mask?: string[];
  
  // Full page screenshot instead of element
  fullPage?: boolean;
}
```

### Example Usage

```typescript
// Strict comparison (0% difference allowed)
await expectVisualMatch(page, 'component-strict', {
  threshold: 0,
  maxDiffPixels: 0,
});

// Lenient comparison (50% difference allowed)
await expectVisualMatch(page, 'component-lenient', {
  threshold: 0.5,
  maxDiffPixels: 1000,
});

// With animation delay
await expectVisualMatch(page, 'component-animated', {
  animationDelay: 1000, // Wait 1 second for animations
});

// Full page screenshot
await expectFullPageVisualMatch(page, 'full-page', {
  animationDelay: 500,
});
```

## Browser Configuration

### Adding New Browsers

```typescript
projects: [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'firefox',
    use: { ...devices['Desktop Firefox'] },
  },
  {
    name: 'webkit',
    use: { ...devices['Desktop Safari'] },
  },
  {
    name: 'Microsoft Edge',
    use: { ...devices['Desktop Edge'], channel: 'msedge' },
  },
  {
    name: 'Google Chrome',
    use: { ...devices['Desktop Chrome'], channel: 'chrome' },
  },
],
```

### Browser-Specific Settings

```typescript
{
  name: 'chromium',
  use: {
    ...devices['Desktop Chrome'],
    // Disable automation detection
    launchArgs: ['--disable-blink-features=AutomationControlled'],
    // Custom viewport
    viewport: { width: 1920, height: 1080 },
    // Device scale factor
    deviceScaleFactor: 2,
    // Locale
    locale: 'en-US',
    // Timezone
    timezoneId: 'America/New_York',
    // Geolocation
    geolocation: { latitude: 37.7749, longitude: -122.4194 },
    // Permissions
    permissions: ['geolocation'],
  },
}
```

## Viewport Configuration

### Predefined Viewports

```typescript
export const VIEWPORTS = {
  mobile: { width: 375, height: 667, label: 'mobile' },      // iPhone SE
  tablet: { width: 768, height: 1024, label: 'tablet' },     // iPad
  desktop: { width: 1440, height: 900, label: 'desktop' },   // Standard desktop
  wide: { width: 1920, height: 1080, label: 'wide' },        // Full HD
};
```

### Custom Viewports

```typescript
const CUSTOM_VIEWPORTS = {
  iphone12: { width: 390, height: 844, label: 'iPhone 12' },
  iphone12Pro: { width: 390, height: 844, label: 'iPhone 12 Pro' },
  iphone12ProMax: { width: 428, height: 926, label: 'iPhone 12 Pro Max' },
  ipadAir: { width: 820, height: 1180, label: 'iPad Air' },
  ipadPro: { width: 1024, height: 1366, label: 'iPad Pro' },
  surfacePro: { width: 912, height: 1368, label: 'Surface Pro' },
  galaxyS21: { width: 360, height: 800, label: 'Galaxy S21' },
};
```

## Reporter Configuration

### HTML Reporter

```typescript
reporter: [
  ['html', {
    outputFolder: 'playwright-report',
    open: 'never', // 'always', 'never', 'on-failure'
  }],
],
```

### JSON Reporter

```typescript
reporter: [
  ['json', {
    outputFile: 'test-results/results.json',
  }],
],
```

### JUnit Reporter

```typescript
reporter: [
  ['junit', {
    outputFile: 'test-results/junit.xml',
    embedAnnotationsAsProperties: true,
    useTestIdAsTestCaseName: true,
  }],
],
```

### Custom Reporter

```typescript
reporter: [
  ['./custom-reporter.ts'],
],
```

## Trace and Video Configuration

### Trace Collection

```typescript
use: {
  // Collect trace on first retry
  trace: 'on-first-retry',
  
  // Always collect trace
  // trace: 'on',
  
  // Never collect trace
  // trace: 'off',
},
```

### Video Recording

```typescript
use: {
  // Record video on failure
  video: 'retain-on-failure',
  
  // Always record video
  // video: 'on',
  
  // Never record video
  // video: 'off',
  
  // Video size
  videoSize: { width: 1280, height: 720 },
},
```

## Screenshot Configuration

### Screenshot on Failure

```typescript
use: {
  // Take screenshot on failure
  screenshot: 'only-on-failure',
  
  // Always take screenshot
  // screenshot: 'on',
  
  // Never take screenshot
  // screenshot: 'off',
},
```

## Timeout Configuration

### Global Timeout

```typescript
// Timeout for entire test
timeout: 30 * 1000, // 30 seconds

// Timeout for expect assertions
expect: {
  timeout: 5 * 1000, // 5 seconds
},
```

### Per-Test Timeout

```typescript
test('slow test', async ({ page }) => {
  test.setTimeout(60 * 1000); // 60 seconds for this test
  // ...
});
```

## Retry Configuration

### Global Retries

```typescript
// Retry failed tests
retries: process.env.CI ? 2 : 0,
```

### Per-Test Retries

```typescript
test.describe('flaky tests', () => {
  test.describe.configure({ retries: 2 });
  
  test('flaky test', async ({ page }) => {
    // This test will retry up to 2 times
  });
});
```

## Worker Configuration

### Parallel Workers

```typescript
// Number of parallel workers
workers: process.env.CI ? 1 : undefined, // undefined = auto-detect

// Or specify number
workers: 4,
```

### Sequential Execution

```typescript
// Run tests sequentially
workers: 1,
```

## Environment Variables

### Common Variables

```bash
# Enable CI mode
CI=true

# Skip browser download
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Set base URL
PLAYWRIGHT_TEST_BASE_URL=http://localhost:5173

# Enable debug mode
DEBUG=pw:api

# Set timeout
PLAYWRIGHT_TIMEOUT=30000

# Set expect timeout
PLAYWRIGHT_EXPECT_TIMEOUT=5000
```

### Custom Variables

```typescript
// In playwright.config.ts
export default defineConfig({
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173',
    trace: process.env.PLAYWRIGHT_TRACE || 'on-first-retry',
  },
});

// In test file
test('use custom variable', async ({ page }) => {
  const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL;
  await page.goto(baseURL);
});
```

## Baseline Snapshot Configuration

### Snapshot Directory

```typescript
// Default: __screenshots__
// Custom:
export default defineConfig({
  snapshotDir: './src/tests/visual/snapshots',
  snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-{platform}{ext}',
});
```

### Snapshot Naming

```typescript
// Default naming
await expect(page).toHaveScreenshot('component.png');

// Custom naming with platform
await expect(page).toHaveScreenshot(`component-${process.platform}.png`);

// Nested naming
await expect(page).toHaveScreenshot('components/button/hover.png');
```

## Advanced Configuration

### Conditional Configuration

```typescript
export default defineConfig({
  // Different config for CI vs local
  ...(process.env.CI ? {
    retries: 2,
    workers: 1,
  } : {
    retries: 0,
    workers: 4,
  }),
});
```

### Multiple Configuration Files

```typescript
// playwright.config.ts (default)
export default defineConfig({
  // Default configuration
});

// playwright.ci.config.ts (for CI)
export default defineConfig({
  // CI-specific configuration
});
```

Run with specific config:
```bash
npx playwright test --config=playwright.ci.config.ts
```

### Configuration Profiles

```typescript
export default defineConfig({
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
});
```

Run specific profile:
```bash
npx playwright test --project=chromium-mobile
```

## Performance Tuning

### Optimize for Speed

```typescript
export default defineConfig({
  // Reduce retries
  retries: 0,
  
  // Increase workers
  workers: 8,
  
  // Disable video
  use: {
    video: 'off',
  },
  
  // Disable trace
  use: {
    trace: 'off',
  },
});
```

### Optimize for Reliability

```typescript
export default defineConfig({
  // Increase retries
  retries: 3,
  
  // Reduce workers
  workers: 1,
  
  // Enable video
  use: {
    video: 'on',
  },
  
  // Enable trace
  use: {
    trace: 'on',
  },
  
  // Increase timeouts
  timeout: 60 * 1000,
  expect: { timeout: 10 * 1000 },
});
```

## Debugging Configuration

### Debug Mode

```bash
# Run tests in debug mode
npx playwright test --debug

# Run with inspector
npx playwright test --debug --headed

# Run with trace viewer
npx playwright show-trace trace.zip
```

### Verbose Logging

```bash
# Enable debug logging
DEBUG=pw:api npx playwright test

# Enable all logging
DEBUG=pw:* npx playwright test
```

## Resources

- [Playwright Configuration](https://playwright.dev/docs/test-configuration)
- [Test Options](https://playwright.dev/docs/api/class-testoptions)
- [Reporters](https://playwright.dev/docs/test-reporters)
- [Debugging](https://playwright.dev/docs/debug)
