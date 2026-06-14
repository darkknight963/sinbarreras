import { chromium } from 'playwright';
import { createServer } from 'net';
import { buildCoverageReport } from './coverageReport.js';
import { detectPageContent } from './content-detector.js';
import { captureFocusTraversal } from './focusTraversal.js';
import { captureSemanticStructure } from './semanticStructure.js';
import { uploadEvidence } from './storage.js';
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
  runPa11y,
  runLighthouse,
  runIbmEqualAccessUrl,
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

  // Lighthouse and Pa11y each spawn their own Chrome. Running them sequentially before
  // Playwright avoids concurrent Chrome processes competing for memory and crashing each other.
  const pa11yStart = Date.now();
  let pa11yFindings: any[] = [];
  let pa11yReportEntry: any = null;
  try {
    console.log(`Running Pa11y pre-scan: ${url}`);
    pa11yFindings = await runPa11y(url, 0);
    pa11yReportEntry = { engine: 'pa11y', pageState: 'initial', status: 'ok', durationMs: Date.now() - pa11yStart, findingsCount: pa11yFindings.length };
    console.log(`Pa11y pre-scan complete: ${pa11yFindings.length} finding(s).`);
  } catch (err) {
    console.warn('Pa11y pre-scan failed; continuing without Pa11y.', err);
    pa11yReportEntry = { engine: 'pa11y', pageState: 'initial', status: 'failed', durationMs: Date.now() - pa11yStart, findingsCount: 0, errorMessage: String(err) };
  }

  const lighthouseStart = Date.now();
  let lighthouseFindings: any[] = [];
  let lighthouseReportEntry: any = null;
  try {
    console.log(`Running Lighthouse pre-scan: ${url}`);
    lighthouseFindings = await runLighthouse(url);
    lighthouseReportEntry = { engine: 'lighthouse', pageState: 'initial', status: 'ok', durationMs: Date.now() - lighthouseStart, findingsCount: lighthouseFindings.length };
    console.log(`Lighthouse pre-scan complete: ${lighthouseFindings.length} finding(s).`);
  } catch (err) {
    console.warn('Lighthouse pre-scan failed; continuing without Lighthouse.', err);
    lighthouseReportEntry = { engine: 'lighthouse', pageState: 'initial', status: 'failed', durationMs: Date.now() - lighthouseStart, findingsCount: 0, errorMessage: String(err) };
  }

  const ibmStart = Date.now();
  let ibmFindings: any[] = [];
  let ibmReportEntry: any = null;
  try {
    console.log(`Running IBM Equal Access pre-scan: ${url}`);
    ibmFindings = await runIbmEqualAccessUrl(url);
    ibmReportEntry = { engine: 'ibm-equal-access', pageState: 'initial', status: 'ok', durationMs: Date.now() - ibmStart, findingsCount: ibmFindings.length };
    console.log(`IBM Equal Access pre-scan complete: ${ibmFindings.length} finding(s).`);
  } catch (err) {
    console.warn('IBM Equal Access pre-scan failed; continuing without IBM.', err);
    ibmReportEntry = { engine: 'ibm-equal-access', pageState: 'initial', status: 'failed', durationMs: Date.now() - ibmStart, findingsCount: 0, errorMessage: String(err) };
  }

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
    await validateScanTargetUrl(url);
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    // Try to wait for network to settle; if the site has persistent trackers this will timeout — that's fine.
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
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
      ...pa11yFindings,
      ...lighthouseFindings,
      ...ibmFindings,
    ];
    const coverageReport = buildCoverageReport(mergedRaw);
    const dedupedRaw = dedupeByRuleAndSelector(mergedRaw);
    const grouped = groupFindings(dedupedRaw);
    const formattedViolations = await enrichAndCapture(page, grouped);
    const currentVisualEvidenceState = hasOverlayWorkflow ? 'post_overlay' : 'initial';
    const currentVisualEvidence = await captureVisualEvidence(page, formattedViolations as any, currentVisualEvidenceState).catch((err) => {
      console.warn('Final visual evidence capture failed.', err);
      return null;
    });
    const mandatoryVisualEvidence = !currentVisualEvidence && formattedViolations.length > 0
      ? await (async () => {
          try {
            const buffer = await page.screenshot({ fullPage: true }).catch(() =>
              page.screenshot({ fullPage: false }),
            );
            const screenshotUrl = await uploadEvidence(
              `visual-fallback-${currentVisualEvidenceState}-${Date.now()}.png`,
              buffer,
              'image/png',
            );
            const dimensions = await page.evaluate(() => ({
              viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
              },
              pageSize: {
                width: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0, window.innerWidth),
                height: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0, window.innerHeight),
              },
            }));

            console.log(`Created mandatory visual evidence for ${formattedViolations.length} finding(s).`);
            return {
              pageState: currentVisualEvidenceState,
              pageStateLabel: currentVisualEvidenceState === 'initial' ? 'Estado inicial' : 'Despues de cerrar modales',
              screenshotUrl,
              viewport: dimensions.viewport,
              pageSize: dimensions.pageSize,
              markers: [],
            };
          } catch (err) {
            console.warn('Mandatory visual evidence capture failed.', err);
            return null;
          }
        })()
      : null;
    const fallbackScreenshotUrl =
      currentVisualEvidence?.screenshotUrl ||
      mandatoryVisualEvidence?.screenshotUrl ||
      initialVisualEvidence?.screenshotUrl ||
      '';

    if (fallbackScreenshotUrl) {
      for (const finding of formattedViolations) {
        if (!finding.screenshotUrl) {
          finding.screenshotUrl = fallbackScreenshotUrl;
        }
      }
    }
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
          currentVisualEvidence || mandatoryVisualEvidence,
        ].filter(Boolean),
      },
      coverageReport,
      peruvianChecks: peruvianResults,
      engineReport: [
        ...initialEngineRun.report,
        ...postOverlayEngineRun.report,
        ...interactiveStateEngineRun.report,
        ...supportingEngineRun.report,
        ...(pa11yReportEntry ? [pa11yReportEntry] : []),
        ...(lighthouseReportEntry ? [lighthouseReportEntry] : []),
        ...(ibmReportEntry ? [ibmReportEntry] : []),
      ],
      device: options.viewport?.width === 375 ? 'Movil' : options.viewport?.width === 768 ? 'Tablet' : 'Desktop',
      htmlDumpUrl: '',
    };
  } finally {
    await context.close();
    await browser.close();
  }
}
