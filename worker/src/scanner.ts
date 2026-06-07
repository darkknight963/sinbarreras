import { chromium } from 'playwright';
import { createServer } from 'net';
import { buildCoverageReport } from './coverageReport.js';
import { detectPageContent } from './content-detector.js';
import { captureFocusTraversal } from './focusTraversal.js';
import { captureSemanticStructure } from './semanticStructure.js';
import { captureVisualEvidence } from './visualEvidence.js';
import { buildApplicability, conservativeApplicability, summarizeApplicability } from './wcag-applicability.js';
import { validateScanTargetUrl } from './urlPolicy.js';
import {
  detectOverlayCandidates,
  enrichAndCapture,
  handleCommonOverlays,
  runInteractiveStateAccessibilityEngines,
  runOverlayAccessibilityEngines,
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
export {
  detectOverlayCandidates,
  enrichAndCapture,
  handleCommonOverlays,
  runInteractiveStateAccessibilityEngines,
  runOverlayAccessibilityEngines,
  runStatefulPageEngines,
  runSupportingEngines,
} from './scanner-engines.js';

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
    const browserHelperScript = `
      globalThis.__name = globalThis.__name || function(fn) { return fn; };
      var __name = globalThis.__name;
    `;
    await page.addInitScript(browserHelperScript);
    await page.evaluate(browserHelperScript).catch(() => {});

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

    const initialOverlays = await detectOverlayCandidates(page);
    console.log(
      initialOverlays.length > 0
        ? `Running accessibility engines on ${initialOverlays.length} blocking overlay(s)...`
        : 'Running accessibility engines on initial page state...',
    );
    const initialEngineRun = initialOverlays.length > 0
      ? await runOverlayAccessibilityEngines(page, initialOverlays, 'initial')
      : await runStatefulPageEngines(page, 'initial');
    const initialVisualEvidence = await captureVisualEvidence(page, initialEngineRun.findings, 'initial').catch((err) => {
      console.warn('Initial visual evidence capture failed.', err);
      return null;
    });
    await reportProgress(35);

    const overlayAction = await handleCommonOverlays(page);
    const hasOverlayWorkflow = initialOverlays.length > 0 || overlayAction !== 'not_found';
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
    const postOverlayEngineRun = hasOverlayWorkflow
      ? await runStatefulPageEngines(page, 'post_overlay')
      : { findings: [], report: [] };
    if (hasOverlayWorkflow) {
      console.log('Running accessibility engines after modal handling...');
    } else {
      console.log('No blocking overlay detected; keeping analysis in initial page state.');
    }
    console.log('Exploring safe interactive states for hidden menus and dialogs...');
    const interactiveStateEngineRun = await runInteractiveStateAccessibilityEngines(page);
    const supportingEngineRun = await runSupportingEngines(url, debugPort, hasOverlayWorkflow ? 'post_overlay' : 'initial');
    await reportProgress(65);

    const mergedRaw = [
      ...initialEngineRun.findings,
      ...postOverlayEngineRun.findings,
      ...interactiveStateEngineRun.findings,
      ...supportingEngineRun.findings,
    ];
    const coverageReport = buildCoverageReport(mergedRaw);
    const dedupedRaw = dedupeByRuleAndSelector(mergedRaw);
    const grouped = groupFindings(dedupedRaw);
    await reportProgress(75);
    const formattedViolations = await enrichAndCapture(page, grouped);
    const currentVisualEvidenceState = hasOverlayWorkflow ? 'post_overlay' : 'initial';
    const currentVisualEvidence = await captureVisualEvidence(page, formattedViolations as any, currentVisualEvidenceState).catch((err) => {
      console.warn('Final visual evidence capture failed.', err);
      return null;
    });
    await reportProgress(85);

    const focusTraversal = await captureFocusTraversal(page);
    const semanticStructure = await captureSemanticStructure(page);

    const failedCriterionIds = new Set(
      formattedViolations
        .filter((v) => (v.findingStatus || 'confirmed') === 'confirmed' && isSpecificCriterion(v.criterion))
        .map((v) => v.criterion),
    );
    const reviewCriterionIds = new Set(
      formattedViolations
        .filter((v) => (v.findingStatus || v.status || 'confirmed') !== 'confirmed' && isSpecificCriterion(v.criterion))
        .map((v) => v.criterion),
    );
    const applicabilitySummary = summarizeApplicability(applicability, failedCriterionIds, reviewCriterionIds);
    const score = applicabilitySummary.score;

    console.log('Running Peruvian compliance heuristics...');
    const peruvianResults = await import('./peruvianChecks.js').then((mod) => mod.runPeruvianChecks(page, url));
    await reportProgress(95);

    return {
      score,
      violations: formattedViolations,
      applicability,
      applicabilitySummary,
      focusTraversal,
      semanticStructure,
      visualMap: {
        states: [
          initialOverlays.length > 0 ? initialVisualEvidence : null,
          currentVisualEvidence,
        ].filter(Boolean),
      },
      coverageReport,
      peruvianChecks: peruvianResults,
      engineReport: [
        ...initialEngineRun.report,
        ...postOverlayEngineRun.report,
        ...interactiveStateEngineRun.report,
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
