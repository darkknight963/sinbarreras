import { defineConfig, devices } from '@playwright/test';

/**
 * Visual Regression Testing Configuration
 * 
 * This configuration sets up Playwright for visual regression testing
 * across multiple browsers and viewports. It includes:
 * - Baseline snapshot management
 * - Cross-browser testing (Chromium, Firefox, WebKit)
 * - Responsive design testing (mobile, tablet, desktop)
 * - CI/CD integration with automatic retries
 * - Comprehensive reporting and tracing
 */
export default defineConfig({
  testDir: './src/tests/visual',
  testMatch: '**/*.visual.test.ts',
  
  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
  ],

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: 'http://localhost:5173',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure for debugging */
    video: 'retain-on-failure',

    /* Visual regression testing settings */
    /* Threshold for pixel difference (0-1) */
    /* Lower threshold = stricter comparison */
    /* Default 0.2 allows 20% pixel difference */
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        /* Visual regression settings per browser */
        launchArgs: ['--disable-blink-features=AutomationControlled'],
      },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    /* Test against tablet viewports */
    {
      name: 'iPad',
      use: { ...devices['iPad Pro'] },
    },

    /* Test against branded browsers */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  /* Global timeout for tests */
  timeout: 30 * 1000,

  /* Expect timeout */
  expect: {
    timeout: 5 * 1000,
  },
});
