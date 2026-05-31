import { chromium } from 'playwright';
import { createServer } from 'net';
import { buildCoverageReport } from './coverageReport.js';
import { detectPageContent } from './content-detector.js';
import { buildApplicability, conservativeApplicability, summarizeApplicability } from './wcag-applicability.js';
import { validateScanTargetUrl } from './urlPolicy.js';
import {
  enrichAndCapture,
  handleCommonOverlays,
  runStatefulPageEngines,
  runSupportingEngines,
} from './scanner-engines.js';
import {
  dedupeByRuleAndSelector,
  groupFindings,
  isSpecificCriterion,
} from './scanner-utils.js';

export * from './scanner-models.js';
export * from './scanner-utils.js';
export { enrichAndCapture, handleCommonOverlays, runStatefulPageEngines, runSupportingEngines } from './scanner-engines.js';

declare const document: any;
declare const window: any;

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        reject(new Error('Failed to allocate debug port'));
        return;
      }
      const port = addr.port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

export async function scanUrl(url: string, options: {
  viewport?: { width: number; height: number };
  preNavigationScript?: string;
  onProgress?: (progress: number) => Promise<void> | void;
} = {}) {
  const reportProgress = async (progress: number) => {
    if (!options.onProgress) return;
    await options.onProgress(Math.max(0, Math.min(100, Math.round(progress))));
  };

  const debugPort = await getFreePort();
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', `--remote-debugging-port=${debugPort}`],
  });

  const context = await browser.newContext({
    viewport: options.viewport || { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 PeruAccessibilityAnalyzer/1.0',
  });

  const page = await context.newPage();

  try {
    await context.route('**/*', async (route) => {
      const requestUrl = route.request().url();
      try {
        if (requestUrl.startsWith('http://') || requestUrl.startsWith('https://')) {
          await validateScanTargetUrl(requestUrl);
        }
        await route.continue();
      } catch {
        await route.abort('blockedbyclient');
      }
    });

    console.log(`Navigating to: ${url}`);
    await reportProgress(5);
    await validateScanTargetUrl(url);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await reportProgress(15);

    let applicability = conservativeApplicability();
    try {
      const contentDetection = await detectPageContent(page);
      applicability = buildApplicability(contentDetection);
    } catch (err) {
      console.warn('Content applicability detection failed; using conservative applicability.', err);
    }

    console.log('Running accessibility engines on initial page state...');
    const initialEngineRun = await runStatefulPageEngines(page, 'initial');
    await reportProgress(35);

    await handleCommonOverlays(page);
    await page.waitForLoadState('networkidle').catch(() => { });
    try {
      const contentDetection = await detectPageContent(page);
      applicability = buildApplicability(contentDetection);
    } catch (err) {
      console.warn('Content applicability detection after modal handling failed; keeping previous applicability state.', err);
    }

    if (options.preNavigationScript && process.env.ALLOW_PRE_NAVIGATION_SCRIPT === 'true') {
      console.log('Running pre-navigation script...');
      await reportProgress(40);
      await page.evaluate(async (scriptText) => {
        const fn = new Function('window', 'document', `"use strict"; return (async () => { ${scriptText} })();`);
        await fn(window, document);
      }, options.preNavigationScript);
      await page.waitForTimeout(2000);
      await page.waitForLoadState('networkidle').catch(() => { });
      await handleCommonOverlays(page);
      try {
        const contentDetection = await detectPageContent(page);
        applicability = buildApplicability(contentDetection);
      } catch (err) {
        console.warn('Content applicability detection after pre-navigation failed; keeping conservative/applicable state.', err);
      }
    }

    await reportProgress(50);
    console.log('Running accessibility engines after modal handling...');
    const postOverlayEngineRun = await runStatefulPageEngines(page, 'post_overlay');
    const supportingEngineRun = await runSupportingEngines(url, debugPort);
    await reportProgress(65);

    const mergedRaw = [
      ...initialEngineRun.findings,
      ...postOverlayEngineRun.findings,
      ...supportingEngineRun.findings,
    ];
    const coverageReport = buildCoverageReport(mergedRaw);
    const dedupedRaw = dedupeByRuleAndSelector(mergedRaw);
    const grouped = groupFindings(dedupedRaw);
    await reportProgress(75);
    const formattedViolations = await enrichAndCapture(page, grouped);
    await reportProgress(85);

    const failedCriterionIds = new Set(
      formattedViolations
        .filter((v) => (v.findingStatus || 'confirmed') === 'confirmed' && isSpecificCriterion(v.criterion))
        .map((v) => v.criterion),
    );
    const applicabilitySummary = summarizeApplicability(applicability, failedCriterionIds);
    const score = applicabilitySummary.score;

    console.log('Running Peruvian compliance heuristics...');
    const peruvianResults = await import('./peruvianChecks.js').then((mod) => mod.runPeruvianChecks(page, url));
    await reportProgress(95);

    return {
      score,
      violations: formattedViolations,
      applicability,
      applicabilitySummary,
      coverageReport,
      peruvianChecks: peruvianResults,
      engineReport: [
        ...initialEngineRun.report,
        ...postOverlayEngineRun.report,
        ...supportingEngineRun.report,
      ],
      device: options.viewport?.width === 375 ? 'Movil' : options.viewport?.width === 768 ? 'Tablet' : 'Desktop',
      htmlDumpUrl: '',
    };
  } finally {
    await context.close();
    await browser.close();
  }
}
