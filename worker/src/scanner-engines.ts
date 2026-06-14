import axeCore from 'axe-core';
import { chromium, Page } from 'playwright';
import { buildManualGuidance } from './manualGuidanceBuilder.js';
import { enforceClassification } from './classificationPolicy.js';
import { getRuleDetails, defaultSuggestedFix } from './wcagRules.js';
import { uploadEvidence } from './storage.js';
import type {
  EngineRunResult,
  EngineRunSummary,
  FindingCategory,
  OverlayAction,
  OverlayCandidate,
  PageState,
  RawFinding,
  ScannerEngineName,
} from './scanner-models.js';
import {
  labelPageState,
  normalizeRuleId,
  normalizeSelector,
  parseWcagTags,
  tagFindingsWithPageState,
  toCategoryFromLighthouse,
  toSeverityEs,
  resolveLegalReference,
  resolveStatusLabel,
} from './scanner-utils.js';
import type { GroupedFinding } from './scanner-models.js';

const axeSource = axeCore.source;
declare const document: any;
declare const window: any;

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === 'string' ? err : 'Unknown engine failure';
}

function buildSummary(
  engine: ScannerEngineName,
  pageState: PageState | undefined,
  startedAt: number,
  findingsCount: number,
  status: 'ok' | 'failed',
  errorMessage?: string,
): EngineRunSummary {
  return {
    engine,
    pageState,
    status,
    durationMs: Date.now() - startedAt,
    findingsCount,
    errorMessage,
  };
}

export interface EngineStep {
  engine: ScannerEngineName;
  pageState?: PageState;
  onFailureMessage: string;
  run: () => Promise<RawFinding[]>;
}

export async function runEngineSeries(steps: EngineStep[]): Promise<EngineRunResult<RawFinding[]>> {
  const findings: RawFinding[] = [];
  const report: EngineRunSummary[] = [];

  for (const step of steps) {
    const startedAt = Date.now();
    try {
      const stepFindings = await step.run();
      findings.push(...stepFindings);
      report.push(buildSummary(step.engine, step.pageState, startedAt, stepFindings.length, 'ok'));
    } catch (err) {
      console.warn(step.onFailureMessage, err);
      report.push(buildSummary(step.engine, step.pageState, startedAt, 0, 'failed', getErrorMessage(err)));
    }
  }

  return { findings, report };
}

export async function detectOverlayCandidates(page: Page): Promise<OverlayCandidate[]> {
  return await page.evaluate(`(() => {
    const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
    const escapeRe = (value) => String(value || '').replace(/[.*+?^\\x24{}()|[\\]\\\\]/g, '\\\\$&');
    const classOrIdHasToken = (el, tokens) => {
      const text = [
        el.getAttribute('class') || '',
        el.getAttribute('id') || '',
        el.getAttribute('data-testid') || '',
        el.getAttribute('aria-label') || ''
      ].join(' ').toLowerCase();
      return tokens.some((token) => new RegExp('(^|[^a-z0-9])' + escapeRe(token) + '([^a-z0-9]|$)', 'i').test(text));
    };
    const isVisible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || '1') > 0.05
        && rect.width > 120
        && rect.height > 80;
    };
    const isInViewport = (rect) => rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
    const isBlockingOverlay = (el) => {
      if (!isVisible(el)) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (!isInViewport(rect)) return false;
      const area = Math.max(0, rect.width) * Math.max(0, rect.height);
      const areaRatio = area / viewportArea;
      const position = style.position;
      const zIndex = Number.parseInt(style.zIndex || '0', 10);
      const hasDialogSemantics = el.getAttribute('role') === 'dialog'
        || el.getAttribute('role') === 'alertdialog'
        || el.getAttribute('aria-modal') === 'true';
      const hasOverlayToken = classOrIdHasToken(el, ['modal', 'dialog', 'popup', 'popover', 'cookie', 'cookies', 'consent', 'banner']);
      const bodyModalOpen = /(^|\\s)(modal-open|overflow-hidden|no-scroll)(\\s|$)/i.test(document.body?.className || '');
      const coversViewport = areaRatio >= 0.35;
      const cookieBar = hasOverlayToken && rect.width / window.innerWidth >= 0.72 && rect.height >= 70 && (rect.top < 80 || rect.bottom > window.innerHeight - 80);
      const visuallyFloats = position === 'fixed' || (position === 'absolute' && (Number.isFinite(zIndex) ? zIndex >= 100 : false));
      return hasDialogSemantics
        || bodyModalOpen && hasOverlayToken && areaRatio >= 0.08
        || cookieBar
        || (hasOverlayToken && visuallyFloats && areaRatio >= 0.12)
        || (position === 'fixed' && coversViewport && (Number.isFinite(zIndex) ? zIndex >= 50 : true));
    };
    const keywordSelector = [
      '[role="dialog"]',
      '[role="alertdialog"]',
      '[aria-modal="true"]',
      '.modal',
      '.modal-dialog',
      '[class*="modal" i]',
      '[class*="popup" i]',
      '[class*="cookie" i]',
      '[class*="banner" i]',
      '[id*="cookie" i]',
      '[id*="popup" i]'
    ].join(',');

    const explicit = Array.from(document.querySelectorAll(keywordSelector));
    const positioned = Array.from(document.querySelectorAll('body *')).filter((el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const position = style.position;
      const zIndex = Number.parseInt(style.zIndex || '0', 10);
      const area = Math.max(0, rect.width) * Math.max(0, rect.height);
      return isVisible(el)
        && ['fixed', 'absolute'].includes(position)
        && area / viewportArea >= 0.12
        && (Number.isFinite(zIndex) ? zIndex >= 50 : position === 'fixed');
    });

    const candidates = Array.from(new Set([...explicit, ...positioned]));
    return candidates
      .filter(isBlockingOverlay)
      .slice(0, 3)
      .map((el, index) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const text = (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 500);
        const lower = text.toLowerCase();
        const id = 'sb-overlay-' + index;
        el.setAttribute('data-sb-overlay-id', id);
        const attrText = [
          el.getAttribute('id') || '',
          el.getAttribute('role') || '',
          el.getAttribute('aria-label') || '',
          el.getAttribute('class') || '',
          lower
        ].join(' ').toLowerCase();
        let kind = 'overlay';
        if (/cookie|cookies|galleta|consent|privacidad/.test(attrText)) kind = 'cookie';
        else if (/terminos|términos|condiciones|legal|acepto|acuerdo/.test(attrText)) kind = 'terms';
        else if (/edad|age|mayor de edad|18\\+/.test(attrText)) kind = 'age_gate';
        else if (/bienvenida|welcome|anuncio|promo|newsletter/.test(attrText)) kind = 'announcement';
        else if (/dialog|modal/.test(attrText)) kind = 'dialog';
        const zIndex = Number.parseInt(style.zIndex || '0', 10);
        return {
          id,
          selector: '[data-sb-overlay-id="' + id + '"]',
          html: el.outerHTML.slice(0, 2000),
          text,
          kind,
          blocksViewport: rect.width * rect.height / viewportArea >= 0.35 || style.position === 'fixed',
          zIndex: Number.isFinite(zIndex) ? zIndex : 0
        };
      });
  })()`) as OverlayCandidate[];
}

function overlayFindingDescription(overlay: OverlayCandidate): string {
  const labels: Record<OverlayCandidate['kind'], string> = {
    cookie: 'banner o modal de cookies',
    terms: 'modal de terminos o condiciones',
    age_gate: 'bloqueo de verificacion de edad',
    announcement: 'popup de anuncio o bienvenida',
    dialog: 'dialogo modal',
    overlay: 'overlay visible',
  };
  return `Se detecto un ${labels[overlay.kind]} que bloquea o condiciona la lectura del contenido principal.`;
}

function overlayReviewFinding(overlay: OverlayCandidate): RawFinding {
  return {
    tool: 'heuristic-dom',
    ruleId: 'blocking-overlay-needs-review',
    normalizedRuleId: 'blocking-overlay-needs-review',
    category: 'manual_check',
    wcagCriterion: 'Revision manual',
    findingStatus: 'needs_review',
    description: overlayFindingDescription(overlay),
    selector: normalizeSelector(overlay.selector),
    elementHtml: overlay.html,
    severity: overlay.blocksViewport ? 'alto' : 'medio',
    suggestedFix: 'Asegurar que el overlay tenga nombre accesible, foco gestionado, operacion por teclado, contraste suficiente y una accion clara para cerrarlo o continuar.',
  };
}

export async function closeDetectedOverlays(page: Page): Promise<OverlayAction> {
  const overlays = await detectOverlayCandidates(page);
  if (overlays.length === 0) return 'not_found';

  let skippedSensitive = false;
  for (const overlay of overlays) {
    const selectorPrefix = `${overlay.selector} `;
    const safeCandidates = [
      `${selectorPrefix}button:has-text("Cerrar")`,
      `${selectorPrefix}button:has-text("Cerrar ventana")`,
      `${selectorPrefix}button:has-text("Continuar")`,
      `${selectorPrefix}button:has-text("Entendido")`,
      `${selectorPrefix}button:has-text("OK")`,
      `${selectorPrefix}button:has-text("Omitir")`,
      `${selectorPrefix}button:has-text("Rechazar")`,
      `${selectorPrefix}button:has-text("Solo necesarias")`,
      `${selectorPrefix}a:has-text("Cerrar")`,
      `${selectorPrefix}[aria-label*="cerrar" i]`,
      `${selectorPrefix}[aria-label*="close" i]`,
      `${selectorPrefix}[data-testid*="close" i]`,
    ];
    const acceptCandidates = [
      `${selectorPrefix}button:has-text("Aceptar")`,
      `${selectorPrefix}button:has-text("Acepto")`,
      `${selectorPrefix}button:has-text("Aceptar todo")`,
      `${selectorPrefix}button:has-text("Aceptar todas")`,
      `${selectorPrefix}button:has-text("De acuerdo")`,
      `${selectorPrefix}button:has-text("Estoy de acuerdo")`,
      `${selectorPrefix}a:has-text("Aceptar")`,
      `${selectorPrefix}.cookie-accept`,
      `${selectorPrefix}.cookies-accept`,
      `${selectorPrefix}.accept-cookies`,
    ];

    for (const selector of safeCandidates) {
      const locator = page.locator(selector).first();
      if (!(await locator.count())) continue;
      try {
        await locator.click({ timeout: 1000 });
        await page.waitForTimeout(500);
        return 'closed';
      } catch {
      }
    }

    if (overlay.kind === 'terms' || overlay.kind === 'age_gate') {
      skippedSensitive = true;
      continue;
    }

    for (const selector of acceptCandidates) {
      const locator = page.locator(selector).first();
      if (!(await locator.count())) continue;
      try {
        await locator.click({ timeout: 1000 });
        await page.waitForTimeout(500);
        return 'accepted';
      } catch {
      }
    }
  }

  return skippedSensitive ? 'skipped_sensitive' : 'not_found';
}

export async function handleCommonOverlays(page: Page): Promise<OverlayAction> {
  const action = await closeDetectedOverlays(page);
  if (action !== 'not_found') return action;

  const candidates = [
    'button:has-text("Aceptar")',
    'button:has-text("Acepto")',
    'button:has-text("Acepto los términos")',
    'button:has-text("Aceptar términos")',
    'button:has-text("Aceptar todo")',
    'button:has-text("Aceptar todas")',
    'button:has-text("Cerrar")',
    'button:has-text("Cerrar ventana")',
    'button:has-text("Continuar")',
    'button:has-text("Entendido")',
    'button:has-text("De acuerdo")',
    'button:has-text("Estoy de acuerdo")',
    'a:has-text("Aceptar")',
    'a:has-text("Cerrar")',
    '[aria-label*="cerrar" i]',
    '[aria-label*="close" i]',
    '[data-testid*="close" i]',
    '.cookie-accept',
    '.cookies-accept',
    '.accept-cookies',
    '.modal [data-dismiss="modal"]',
    '.modal-close',
  ];

  for (const selector of candidates) {
    const locator = page.locator(selector).first();
    if (await locator.count()) {
      try {
        await locator.click({ timeout: 1000 });
        await page.waitForTimeout(400);
        return 'closed';
      } catch {
      }
    }
  }

  return 'not_found';
}

async function discoverInteractiveTriggers(page: Page): Promise<Array<{ selector: string; label: string }>> {
  return await page.evaluate(`(() => {
    const escapeCss = window.CSS && CSS.escape ? CSS.escape : (value) => String(value).replace(/"/g, '\\\\"');
    const riskyText = /\\b(eliminar|borrar|delete|remove|pagar|comprar|checkout|salir|logout|cerrar sesi[oó]n|descargar|download|pdf|excel|enviar|submit|guardar|save|crear|create|registrar|register)\\b/i;
    const triggerHints = /\\b(menu|men[uú]|modal|dialog|di[aá]logo|popup|abrir|open|ver m[aá]s|m[aá]s|filtro|filter|opciones|cuenta|perfil|ayuda|soporte|accordion|acorde[oó]n|detalle|detalles)\\b/i;
    const selectors = [
      'button',
      '[role="button"]',
      'summary',
      'a[href^="#"]',
      '[aria-haspopup]',
      '[aria-controls]',
      '[data-toggle]',
      '[data-bs-toggle]',
      '[data-modal]',
      '[class*="dropdown" i]',
      '[class*="accordion" i]',
      '[class*="popover" i]'
    ].join(',');

    const controls = Array.from(document.querySelectorAll(selectors));
    const results = [];
    const seen = new Set();

    for (const el of controls) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const visible = style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || '1') > 0.05
        && rect.width >= 12
        && rect.height >= 12;
      if (!visible) continue;
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;

      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute('type') || '').toLowerCase();
      if (tag === 'button' && ['submit', 'reset'].includes(type)) continue;

      if (tag === 'a') {
        const href = el.getAttribute('href') || '';
        if (!href.startsWith('#') && !href.startsWith('javascript:')) continue;
      }

      const text = [
        el.textContent || '',
        el.getAttribute('aria-label') || '',
        el.getAttribute('title') || '',
        el.getAttribute('class') || '',
        el.getAttribute('id') || '',
        el.getAttribute('aria-haspopup') || '',
        el.getAttribute('aria-controls') || '',
        el.getAttribute('data-toggle') || '',
        el.getAttribute('data-bs-toggle') || '',
        el.getAttribute('data-modal') || ''
      ].join(' ').replace(/\\s+/g, ' ').trim();

      if (riskyText.test(text)) continue;
      const hasProgrammaticHint = el.hasAttribute('aria-haspopup')
        || el.hasAttribute('aria-controls')
        || el.hasAttribute('data-toggle')
        || el.hasAttribute('data-bs-toggle')
        || el.hasAttribute('data-modal')
        || tag === 'summary';
      if (!hasProgrammaticHint && !triggerHints.test(text)) continue;

      const id = 'sb-interactive-trigger-' + results.length;
      el.setAttribute('data-sb-interactive-trigger', id);
      const selector = '[data-sb-interactive-trigger="' + escapeCss(id) + '"]';
      if (seen.has(selector)) continue;
      seen.add(selector);
      results.push({ selector, label: text.slice(0, 120) || tag });
      if (results.length >= 12) break;
    }

    return results;
  })()`) as Array<{ selector: string; label: string }>;
}

function sameDocumentLocation(beforeUrl: string, afterUrl: string) {
  try {
    const before = new URL(beforeUrl);
    const after = new URL(afterUrl);
    return before.origin === after.origin && before.pathname === after.pathname && before.search === after.search;
  } catch {
    return beforeUrl === afterUrl;
  }
}

export async function runInteractiveStateAccessibilityEngines(page: Page): Promise<EngineRunResult<RawFinding[]>> {
  const findings: RawFinding[] = [];
  const report: EngineRunSummary[] = [];

  // Try Escape in case a modal is still open, then bail if overlays remain
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300).catch(() => {});
  const persistentOverlays = await detectOverlayCandidates(page).catch(() => []);
  if (persistentOverlays.length > 0) {
    console.log(`Skipping interactive exploration: ${persistentOverlays.length} blocking overlay(s) still intercept pointer events.`);
    return { findings, report };
  }

  const triggers = await discoverInteractiveTriggers(page);

  for (const trigger of triggers) {
    const beforeUrl = page.url();
    try {
      const locator = page.locator(trigger.selector).first();
      if (!(await locator.count())) continue;

      await locator.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => { });
      await locator.click({ timeout: 1500, trial: false });
      await page.waitForTimeout(450);
      await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => { });

      if (!sameDocumentLocation(beforeUrl, page.url())) {
        await page.goBack({ waitUntil: 'networkidle', timeout: 5000 }).catch(() => { });
        continue;
      }

      const stateRun = await runStatefulPageEngines(page, 'interactive_state');
      findings.push(...stateRun.findings);
      report.push(...stateRun.report);

      const overlays = await detectOverlayCandidates(page);
      if (overlays.length > 0) {
        const overlayRun = await runOverlayAccessibilityEngines(page, overlays, 'interactive_state');
        findings.push(...overlayRun.findings);
        report.push(...overlayRun.report);
      }
    } catch (err) {
      console.warn(`Interactive state exploration skipped for "${trigger.label}".`, err);
    } finally {
      await page.keyboard.press('Escape').catch(() => { });
      await page.waitForTimeout(200).catch(() => { });
      await handleCommonOverlays(page).catch(() => 'not_found');
      if (!sameDocumentLocation(beforeUrl, page.url())) {
        await page.goBack({ waitUntil: 'networkidle', timeout: 5000 }).catch(() => { });
      }
    }
  }

  return { findings, report };
}

async function detectBlockingOverlays(page: Page): Promise<RawFinding[]> {
  const overlays = await detectOverlayCandidates(page);
  return overlays.map(overlayReviewFinding);
}

async function runAxe(page: Page, contextSelector?: string): Promise<RawFinding[]> {
  await page.evaluate((src) => {
    if ((window as any).axe) return;
    const script = window.document.createElement('script');
    script.innerHTML = src;
    window.document.head.appendChild(script);
  }, axeSource);

  const results = await page.evaluate((selector) => {
    const context = selector ? document.querySelector(selector) : document;
    // @ts-ignore
    return axe.run(context || document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag22a', 'wcag22aa', 'wcag22aaa', 'best-practice'],
      },
    });
  }, contextSelector);

  const findings: RawFinding[] = [];
  for (const violation of results.violations || []) {
    const axeRuleKey = normalizeRuleId(violation.id || 'axe-unknown', violation.description || violation.help || '');
    const axeRuleInfo = getRuleDetails(axeRuleKey);
    const axeRawDesc = (violation.description || violation.help || '').replace(/https?:\/\/\S+/g, '').replace(/\s{2,}/g, ' ').trim();
    const axeIsMapped = !axeRuleInfo.nameEs.startsWith('Regla Automática');
    const axeDescription = (axeIsMapped ? axeRuleInfo.nameEs : null) || axeRawDesc || 'Violacion detectada por axe-core';
    for (const node of violation.nodes || []) {
      const selector = Array.isArray(node.target) ? node.target.join(' ') : 'document';
      const fix = (node.any || []).map((item: any) => item.message).join('. ') || 'Asegurar cumplimiento WCAG.';
      findings.push({
        tool: 'axe',
        ruleId: violation.id || 'axe-unknown',
        normalizedRuleId: axeRuleKey,
        category: 'violation',
        ...parseWcagTags(violation.tags),
        description: axeDescription,
        selector: normalizeSelector(selector),
        elementHtml: node.html || '',
        severity: toSeverityEs(violation.impact),
        suggestedFix: axeRuleInfo.suggestedFix || fix,
      });
    }
  }

  return findings;
}

export async function runLighthouse(url: string): Promise<RawFinding[]> {
  const lighthouseModule: any = await import('lighthouse');
  const lighthouse = lighthouseModule.default || lighthouseModule;
  const chromeLauncherModule: any = await import('chrome-launcher');
  const chromeLauncher = chromeLauncherModule.default || chromeLauncherModule;

  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_PATH ||
    process.env.PLAYWRIGHT_CHROME_PATH ||
    chromium.executablePath();

  const chrome = await chromeLauncher.launch({
    chromePath: executablePath,
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  let report: any;
  try {
    report = await lighthouse(url, {
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['accessibility'],
      disableStorageReset: true,
      port: chrome.port,
    });
  } finally {
    await chrome.kill().catch(() => {});
  }

  const lhr = report?.lhr;
  const audits = lhr?.audits || {};
  const findings: RawFinding[] = [];

  for (const [auditId, audit] of Object.entries<any>(audits)) {
    const score = typeof audit?.score === 'number' ? audit.score : 1;
    if (score >= 1) continue;

    const lhRuleKey = normalizeRuleId(String(auditId), audit?.title || audit?.description || '');
    const lhRuleInfo = getRuleDetails(lhRuleKey);
    const lhIsMapped = !lhRuleInfo.nameEs.startsWith('Regla Automática');
    const lhDescription = (lhIsMapped ? lhRuleInfo.nameEs : null) || audit?.title || 'Hallazgo de Lighthouse';
    const lhSuggestedFix = lhRuleInfo.suggestedFix || defaultSuggestedFix(String(auditId));

    const details = audit?.details;
    const items = Array.isArray(details?.items) ? details.items : [{}];

    for (const item of items) {
      const selector = normalizeSelector(item?.node?.selector || item?.selector || 'document');
      const html = item?.node?.snippet || item?.node?.explanation || '';
      findings.push({
        tool: 'lighthouse',
        ruleId: String(auditId),
        normalizedRuleId: lhRuleKey,
        category: toCategoryFromLighthouse(audit),
        description: lhDescription,
        selector,
        elementHtml: html,
        severity: score <= 0.3 ? 'alto' : score <= 0.6 ? 'medio' : 'bajo',
        suggestedFix: lhSuggestedFix,
      });
    }
  }

  return findings;
}

export async function runPa11y(url: string, _port: number): Promise<RawFinding[]> {
  const pa11yModule: any = await import('pa11y' as any);
  const pa11y = pa11yModule.default || pa11yModule;
  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_PATH ||
    process.env.PLAYWRIGHT_CHROME_PATH ||
    chromium.executablePath();

  const result = await pa11y(url, {
    ignoreUrl: false,
    standard: 'WCAG2AA',
    runners: ['axe', 'htmlcs'],
    includeWarnings: true,
    includeNotices: false,
    timeout: 30000,
    wait: 1000,
    chromeLaunchConfig: {
      ignoreHTTPSErrors: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  });

  const findings: RawFinding[] = [];
  for (const issue of result?.issues || []) {
    const pa11yRuleKey = normalizeRuleId(issue.code || 'pa11y-unknown', issue.message || '');
    const pa11yRuleInfo = getRuleDetails(pa11yRuleKey);
    const pa11yRawDesc = (issue.message || '').replace(/https?:\/\/\S+/g, '').replace(/\s{2,}/g, ' ').trim();
    const pa11yIsMapped = !pa11yRuleInfo.nameEs.startsWith('Regla Automática');
    findings.push({
      tool: 'pa11y',
      ruleId: issue.code || 'pa11y-unknown',
      normalizedRuleId: pa11yRuleKey,
      category: issue.typeCode === 1 ? 'violation' : 'alert',
      description: (pa11yIsMapped ? pa11yRuleInfo.nameEs : null) || pa11yRawDesc || 'Hallazgo de Pa11y',
      selector: normalizeSelector(issue.selector || 'document'),
      elementHtml: issue.context || '',
      severity: toSeverityEs(issue.type || issue.typeCode),
      suggestedFix: pa11yRuleInfo.suggestedFix || defaultSuggestedFix(issue.code || 'pa11y-unknown'),
    });
  }

  return findings;
}

let ibmScanSequence = 0;

async function configureIbmEqualAccess(aChecker: any): Promise<void> {
  const currentConfig = await aChecker.getConfig();
  await aChecker.setConfig({
    ...currentConfig,
    puppeteerArgs: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
}

// IBM Equal Access runs as a URL-based pre-scan in scanner.ts (before the Playwright browser
// opens) to avoid its Puppeteer instance interfering with the Playwright page.
export async function runIbmEqualAccessUrl(url: string): Promise<RawFinding[]> {
  const checkerModule: any = await import('accessibility-checker');
  const aChecker = checkerModule.default || checkerModule;
  await configureIbmEqualAccess(aChecker);
  try {
    const report = await aChecker.getCompliance(url, `scan-url-${Date.now()}-${++ibmScanSequence}`);

    // URL-based scans return a flat array at report.report.results; page-based scans return
    // pre-split arrays at report.results.violations / report.results.needsReview.
    const flatResults: any[] = report?.report?.results || report?.results || [];
    const violations = Array.isArray(flatResults)
      ? flatResults.filter((r: any) =>
          r?.level === 'violation' ||
          (Array.isArray(r?.value) && r.value[0] === 'VIOLATION' && r.value[1] === 'FAIL'),
        )
      : (report?.results?.violations || []);
    const needsReview = Array.isArray(flatResults)
      ? flatResults.filter((r: any) =>
          r?.level === 'recommendation' ||
          (Array.isArray(r?.value) && (r.value[0] === 'RECOMMENDATION' || r.value[1] === 'POTENTIAL')),
        )
      : (report?.results?.needsReview || []);

    const findings: RawFinding[] = [];

    for (const v of violations) {
      const domPath = v?.path?.dom || v?.path?.target || (Array.isArray(v?.path) ? v.path[0]?.dom : undefined);
      const snippet = v?.snippet || (Array.isArray(v?.path) ? v.path[0]?.snippet : undefined) || '';
      const ibmViolKey = normalizeRuleId(v?.ruleId || v?.id || 'ibm-unknown', v?.message || v?.reasonId || '');
      const ibmViolInfo = getRuleDetails(ibmViolKey);
      const ibmViolRaw = (v?.message || v?.reasonId || '').replace(/https?:\/\/\S+/g, '').replace(/\s{2,}/g, ' ').trim();
      const ibmViolMapped = !ibmViolInfo.nameEs.startsWith('Regla Automática');
      findings.push({
        tool: 'ibm-equal-access',
        ruleId: v?.ruleId || v?.id || 'ibm-unknown',
        normalizedRuleId: ibmViolKey,
        category: 'violation',
        description: (ibmViolMapped ? ibmViolInfo.nameEs : null) || ibmViolRaw || 'Hallazgo de IBM Equal Access',
        selector: normalizeSelector(domPath || 'document'),
        elementHtml: snippet,
        severity: toSeverityEs(v?.level || v?.impact),
        suggestedFix: ibmViolInfo.suggestedFix || defaultSuggestedFix(v?.ruleId || v?.id || 'ibm-unknown'),
      });
    }

    for (const v of needsReview) {
      const domPath = v?.path?.dom || v?.path?.target || (Array.isArray(v?.path) ? v.path[0]?.dom : undefined);
      const snippet = v?.snippet || (Array.isArray(v?.path) ? v.path[0]?.snippet : undefined) || '';
      const ibmRevKey = normalizeRuleId(v?.ruleId || v?.id || 'ibm-needs-review', v?.message || v?.reasonId || '');
      const ibmRevInfo = getRuleDetails(ibmRevKey);
      const ibmRevRaw = (v?.message || v?.reasonId || '').replace(/https?:\/\/\S+/g, '').replace(/\s{2,}/g, ' ').trim();
      const ibmRevMapped = !ibmRevInfo.nameEs.startsWith('Regla Automática');
      findings.push({
        tool: 'ibm-equal-access',
        ruleId: v?.ruleId || v?.id || 'ibm-needs-review',
        normalizedRuleId: ibmRevKey,
        category: 'manual_check',
        description: (ibmRevMapped ? ibmRevInfo.nameEs : null) || ibmRevRaw || 'Revision manual recomendada por IBM Equal Access',
        selector: normalizeSelector(domPath || 'document'),
        elementHtml: snippet,
        severity: 'medio',
        suggestedFix: ibmRevInfo.suggestedFix || defaultSuggestedFix(v?.ruleId || v?.id || 'ibm-needs-review'),
      });
    }

    console.log(`IBM Equal Access: ${violations.length} violation(s), ${needsReview.length} needs-review.`);
    return findings;
  } finally {
    try { await aChecker.close(); } catch { }
  }
}

async function runHeuristicDomChecks(page: Page): Promise<RawFinding[]> {
  const checks = await page.evaluate(`(() => {
    const findings = [];

    const getSelector = (el) => {
      if (el.id) return '#' + el.id;
      const name = el.getAttribute('name');
      if (name) return el.tagName.toLowerCase() + '[name="' + name + '"]';
      return el.tagName.toLowerCase();
    };

    const isVisible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || '1') > 0.05
        && rect.width > 0
        && rect.height > 0;
    };

    const textOf = (el) => (el?.innerText || el?.textContent || '').replace(/\\s+/g, ' ').trim();

    const accessibleName = (el) => {
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const value = labelledBy
          .split(/\\s+/)
          .map((id) => document.getElementById(id))
          .filter(Boolean)
          .map(textOf)
          .join(' ')
          .trim();
        if (value) return value;
      }
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel.trim();
      if (el.labels?.length) return Array.from(el.labels).map(textOf).join(' ').trim();
      const alt = el.getAttribute('alt');
      if (alt) return alt.trim();
      const title = el.getAttribute('title');
      if (title) return title.trim();
      return textOf(el).slice(0, 120);
    };

    const interactiveSelector = [
      'a[href]',
      'button',
      'input',
      'select',
      'textarea',
      'summary',
      '[role="button"]',
      '[role="link"]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(',');

    if (!document.documentElement.getAttribute('lang')) {
      findings.push({
        ruleId: 'html-lang-missing',
        description: 'El elemento html no tiene atributo lang definido.',
        selector: 'html',
        html: document.documentElement.outerHTML.slice(0, 500),
        wcagCriterion: '3.1.1',
        wcagLevel: 'A',
        category: 'violation',
      });
    }

    const mainCount = document.querySelectorAll('main, [role="main"]').length;
    if (mainCount === 0) {
      findings.push({
        ruleId: 'no-main-landmark',
        description: 'No se encontro landmark principal (main/role=main).',
        selector: 'body',
        html: '<body>',
        wcagCriterion: '2.4.1',
        wcagLevel: 'A',
        category: 'alert',
      });
    }

    const navCount = document.querySelectorAll('nav, [role="navigation"]').length;
    if (navCount === 0) {
      findings.push({
        ruleId: 'no-nav-landmark',
        description: 'No se encontro landmark de navegacion (nav/role=navigation).',
        selector: 'body',
        html: '<body>',
        wcagCriterion: '2.4.1',
        wcagLevel: 'A',
        category: 'alert',
      });
    }

    const hasBypass = !!document.querySelector('a[href^="#main"], a[href*="contenido"], a[href*="skip"], [data-skip-link]');
    if (!hasBypass) {
      findings.push({
        ruleId: 'missing-bypass-method',
        description: 'No se detecto mecanismo visible para saltar bloques repetitivos.',
        selector: 'body',
        html: '<body>',
        wcagCriterion: '2.4.1',
        wcagLevel: 'A',
        category: 'manual_check',
      });
    }

    for (const heading of Array.from(document.querySelectorAll('header h1, [role="banner"] h1'))) {
      if (!isVisible(heading)) continue;
      findings.push({
        ruleId: 'h1-in-header',
        description: 'Se encontro un h1 dentro del encabezado/banner. El h1 principal debe representar el contenido unico de la pagina, no la marca repetida.',
        selector: getSelector(heading),
        html: heading.outerHTML,
        wcagCriterion: '2.4.1',
        wcagLevel: 'A',
        category: 'alert',
      });
    }

    for (const item of Array.from(document.querySelectorAll('li'))) {
      if (!isVisible(item) || item.getAttribute('aria-hidden') === 'true') continue;
      if (textOf(item) || item.querySelector(interactiveSelector)) continue;
      findings.push({
        ruleId: 'empty-list-item',
        description: 'La lista contiene un li vacio o sin contenido discernible.',
        selector: getSelector(item),
        html: item.outerHTML,
        wcagCriterion: '1.3.1',
        wcagLevel: 'A',
        category: 'alert',
      });
    }

    for (const link of Array.from(document.querySelectorAll('a:not([href])'))) {
      if (!isVisible(link)) continue;
      const cursor = window.getComputedStyle(link).cursor;
      if (!link.getAttribute('onclick') && cursor !== 'pointer') continue;
      findings.push({
        ruleId: 'link-href-missing',
        description: 'Un elemento a parece interactivo pero no tiene atributo href.',
        selector: getSelector(link),
        html: link.outerHTML,
        wcagCriterion: '2.1.1',
        wcagLevel: 'A',
        category: 'alert',
      });
    }

    for (const link of Array.from(document.querySelectorAll('a[href], [role="link"]'))) {
      if (!isVisible(link) || accessibleName(link)) continue;
      findings.push({
        ruleId: 'link-name-missing',
        description: 'El enlace no tiene texto ni nombre accesible discernible.',
        selector: getSelector(link),
        html: link.outerHTML,
        wcagCriterion: '2.4.4',
        wcagLevel: 'A',
        category: 'violation',
      });
    }

    for (const button of Array.from(document.querySelectorAll('button, [role="button"]'))) {
      if (!isVisible(button) || accessibleName(button)) continue;
      findings.push({
        ruleId: 'button-name-missing',
        description: 'El control con funcion de boton no tiene nombre programatico.',
        selector: getSelector(button),
        html: button.outerHTML,
        wcagCriterion: '4.1.2',
        wcagLevel: 'A',
        category: 'violation',
      });
    }

    for (const control of Array.from(document.querySelectorAll('input, select, textarea'))) {
      const type = (control.getAttribute('type') || '').toLowerCase();
      if (type === 'hidden' || !isVisible(control)) continue;
      if (accessibleName(control)) continue;
      findings.push({
        ruleId: 'input-name-missing',
        description: 'El campo de formulario no tiene nombre accesible.',
        selector: getSelector(control),
        html: control.outerHTML,
        wcagCriterion: '4.1.2',
        wcagLevel: 'A',
        category: 'violation',
      });
    }

    const requiredChildrenByRole = {
      listbox: ['option'],
      menu: ['menuitem', 'menuitemcheckbox', 'menuitemradio'],
      menubar: ['menuitem', 'menuitemcheckbox', 'menuitemradio'],
      radiogroup: ['radio'],
      tablist: ['tab'],
      tree: ['treeitem'],
      grid: ['row'],
      row: ['cell', 'gridcell', 'columnheader', 'rowheader'],
    };
    for (const [role, children] of Object.entries(requiredChildrenByRole)) {
      for (const widget of Array.from(document.querySelectorAll('[role="' + role + '"]'))) {
        if (!isVisible(widget)) continue;
        const hasRequiredChild = children.some((childRole) => widget.querySelector('[role="' + childRole + '"]'));
        if (hasRequiredChild) continue;
        findings.push({
          ruleId: 'aria-required-owned-element',
          description: 'El rol ' + role + ' requiere elementos hijos con rol: ' + children.join(', ') + '.',
          selector: getSelector(widget),
          html: widget.outerHTML,
          wcagCriterion: '4.1.2',
          wcagLevel: 'A',
          category: 'violation',
        });
      }
    }

    for (const widget of Array.from(document.querySelectorAll('[role="listbox"], [role="combobox"], [role="menu"], [role="radiogroup"], [role="tablist"], [role="tree"], [role="grid"], [role="dialog"], [role="alertdialog"]'))) {
      if (!isVisible(widget) || accessibleName(widget)) continue;
      findings.push({
        ruleId: 'aria-widget-name-missing',
        description: 'Un widget ARIA no tiene nombre accesible programatico.',
        selector: getSelector(widget),
        html: widget.outerHTML,
        wcagCriterion: '4.1.2',
        wcagLevel: 'A',
        category: 'violation',
      });
    }

    for (const table of Array.from(document.querySelectorAll('table'))) {
      if (!isVisible(table)) continue;
      const role = (table.getAttribute('role') || '').toLowerCase();
      if (role === 'presentation' || role === 'none') continue;
      if (table.querySelector('caption, th') || table.getAttribute('aria-label') || table.getAttribute('aria-labelledby')) continue;
      findings.push({
        ruleId: 'table-purpose-review',
        description: 'No se puede determinar si la tabla es de datos o de maquetacion.',
        selector: getSelector(table),
        html: table.outerHTML,
        wcagCriterion: '1.3.1',
        wcagLevel: 'A',
        category: 'manual_check',
      });
    }

    for (const titled of Array.from(document.querySelectorAll('[title]'))) {
      if (!isVisible(titled) || titled.matches(interactiveSelector)) continue;
      findings.push({
        ruleId: 'title-non-interactive',
        description: 'Un elemento no interactivo usa title; puede no estar disponible para teclado o tecnologias de asistencia.',
        selector: getSelector(titled),
        html: titled.outerHTML,
        wcagCriterion: '3.3.2',
        wcagLevel: 'A',
        category: 'alert',
      });
    }

    const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
    const hasToken = (el, tokens) => {
      const text = [
        el.getAttribute('class') || '',
        el.getAttribute('id') || '',
        el.getAttribute('aria-label') || '',
        el.getAttribute('data-testid') || ''
      ].join(' ').toLowerCase();
      return tokens.some((token) => new RegExp('(^|[^a-z0-9])' + token + '([^a-z0-9]|$)', 'i').test(text));
    };
    const isDialogLike = (el) => {
      if (!isVisible(el)) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const areaRatio = Math.max(0, rect.width) * Math.max(0, rect.height) / viewportArea;
      const hasDialogSemantics = el.getAttribute('role') === 'dialog'
        || el.getAttribute('role') === 'alertdialog'
        || el.getAttribute('aria-modal') === 'true';
      const bodyModalOpen = /(^|\\s)(modal-open|overflow-hidden|no-scroll)(\\s|$)/i.test(document.body?.className || '');
      const floatingModal = hasToken(el, ['modal', 'dialog', 'popup', 'popover'])
        && ['fixed', 'absolute'].includes(style.position)
        && areaRatio >= 0.08;
      return hasDialogSemantics || (bodyModalOpen && floatingModal);
    };
    const visibleDialogs = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"], .modal, .modal-dialog, [class*="popup" i]'))
      .filter((el) => isDialogLike(el));
    for (const dialog of visibleDialogs.slice(0, 3)) {
      const backgroundChildren = Array.from(document.body.children).filter((child) => {
        if (child === dialog || child.contains(dialog) || dialog.contains(child)) return false;
        if (!isVisible(child)) return false;
        if (child.hasAttribute('inert')) return false;
        if (child.getAttribute('aria-hidden') === 'true') return false;
        return true;
      });
      if (backgroundChildren.length === 0) continue;
      findings.push({
        ruleId: 'content-behind-dialog-accessible',
        description: 'Hay un dialogo u overlay visible, pero el contenido detras sigue expuesto a tecnologias de asistencia.',
        selector: getSelector(dialog),
        html: dialog.outerHTML,
        wcagCriterion: '1.3.2',
        wcagLevel: 'A',
        category: 'violation',
      });
    }

    const imageBackgroundText = [];
    const ignoredTextTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG']);
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (imageBackgroundText.length >= 12) break;
      if (ignoredTextTags.has(el.tagName)) continue;
      if (!isVisible(el)) continue;
      const text = (el.textContent || '').replace(/\\s+/g, ' ').trim();
      if (text.length < 2 || text.length > 220) continue;
      const childrenWithText = Array.from(el.children).filter((child) => (child.textContent || '').trim().length > 0);
      if (childrenWithText.length > 2) continue;
      let current = el;
      let hasImageBackground = false;
      for (let depth = 0; current && depth < 5; depth++) {
        const backgroundImage = window.getComputedStyle(current).backgroundImage || '';
        if (/url\\(/i.test(backgroundImage)) {
          hasImageBackground = true;
          break;
        }
        current = current.parentElement;
      }
      if (!hasImageBackground) continue;
      imageBackgroundText.push(el);
      findings.push({
        ruleId: 'contrast-image-background-undetermined',
        description: 'El texto se muestra sobre un fondo con imagen; el contraste requiere revision manual sobre la captura real.',
        selector: getSelector(el),
        html: el.outerHTML,
        wcagCriterion: '1.4.3',
        wcagLevel: 'AA',
        category: 'manual_check',
      });
    }

    const elementsWithId = Array.from(document.querySelectorAll('[id]'));
    const idCount = new Map();
    for (const el of elementsWithId) {
      const id = el.getAttribute('id');
      if (!id) continue;
      idCount.set(id, (idCount.get(id) || 0) + 1);
    }
    for (const el of elementsWithId) {
      const id = el.getAttribute('id');
      if (!id) continue;
      if ((idCount.get(id) || 0) > 1) {
        findings.push({
          ruleId: 'duplicate-id',
          description: 'ID duplicado detectado: ' + id,
          selector: '#' + id,
          html: el.outerHTML,
          wcagCriterion: '4.1.2',
          wcagLevel: 'A',
          category: 'violation',
        });
      }
    }

    const controls = Array.from(document.querySelectorAll('input, select, textarea'));
    for (const control of controls) {
      const id = control.getAttribute('id');
      if (!id) continue;
      const labels = Array.from(document.querySelectorAll('label[for="' + id + '"]'));

      if (labels.length > 1) {
        findings.push({
          ruleId: 'multiple-labels',
          description: 'El control tiene multiples labels asociados.',
          selector: getSelector(control),
          html: control.outerHTML,
          wcagCriterion: '3.3.2',
          wcagLevel: 'A',
          category: 'alert',
        });
      }

      for (const label of labels) {
        if (!label.textContent?.trim()) {
          findings.push({
            ruleId: 'label-empty',
            description: 'Label asociado sin texto.',
            selector: getSelector(control),
            html: label.outerHTML,
            wcagCriterion: '3.3.2',
            wcagLevel: 'A',
            category: 'violation',
          });
        }
      }

      if (control.hasAttribute('required')) {
        findings.push({
          ruleId: 'required-html5-attribute',
          description: 'Campo requerido solo marcado por atributo required; verificar indicacion visible e instrucciones.',
          selector: getSelector(control),
          html: control.outerHTML,
          wcagCriterion: '3.3.2',
          wcagLevel: 'A',
          category: 'manual_check',
        });
      }

      const tag = control.tagName.toLowerCase();
      const type = (control.getAttribute('type') || '').toLowerCase();
      const needsAutocomplete = tag === 'input' || tag === 'select';
      if (needsAutocomplete && !['hidden', 'file', 'checkbox', 'radio', 'submit', 'button'].includes(type)) {
        const autocomplete = control.getAttribute('autocomplete');
        if (!autocomplete || autocomplete === 'on' || autocomplete === 'off') {
          findings.push({
            ruleId: 'autocomplete-missing',
            description: 'Campo sin autocomplete especifico para identificar proposito de entrada.',
            selector: getSelector(control),
            html: control.outerHTML,
            wcagCriterion: '1.3.5',
            wcagLevel: 'AA',
            category: 'alert',
          });
        }
      }
    }

    for (const iframe of Array.from(document.querySelectorAll('iframe'))) {
      if (!isVisible(iframe)) continue;
      const title = (iframe.getAttribute('title') || '').trim();
      if (!title) {
        findings.push({
          ruleId: 'iframe-title',
          description: 'El iframe no tiene atributo title que describa su contenido o proposito.',
          selector: getSelector(iframe),
          html: iframe.outerHTML.slice(0, 300),
          wcagCriterion: '2.4.1',
          wcagLevel: 'A',
          category: 'violation',
        });
      } else {
        findings.push({
          ruleId: 'frame-tested',
          description: 'El contenido del iframe "' + title + '" no puede ser evaluado automaticamente. Requiere revision manual o escaneo directo de su URL.',
          selector: getSelector(iframe),
          html: iframe.outerHTML.slice(0, 300),
          wcagCriterion: 'Revision manual',
          wcagLevel: 'A',
          category: 'manual_check',
        });
      }
    }

    return findings;
  })()`) as Array<{
    ruleId: string;
    description: string;
    selector: string;
    html: string;
    wcagCriterion?: string;
    wcagLevel?: 'A' | 'AA' | 'AAA';
    category: FindingCategory;
  }>;

  return checks.map((c) => ({
    tool: 'heuristic-dom',
    ruleId: c.ruleId,
    normalizedRuleId: normalizeRuleId(c.ruleId, c.description),
    category: c.category,
    wcagCriterion: c.wcagCriterion,
    wcagLevel: c.wcagLevel,
    description: c.description,
    selector: normalizeSelector(c.selector),
    elementHtml: c.html || '',
    severity: c.category === 'violation' ? 'alto' : c.category === 'alert' ? 'medio' : 'bajo',
    suggestedFix: getRuleDetails(c.ruleId).suggestedFix || defaultSuggestedFix(c.ruleId),
  }));
}

export async function runStatefulPageEngines(page: Page, pageState: PageState): Promise<EngineRunResult<RawFinding[]>> {
  const result = await runEngineSeries([
    {
      engine: 'axe',
      pageState,
      onFailureMessage: 'Axe execution failed; continuing with other engines.',
      run: async () => runAxe(page),
    },
    {
      engine: 'heuristic-dom',
      pageState,
      onFailureMessage: 'Heuristic DOM checks failed; continuing with other engines.',
      run: async () => runHeuristicDomChecks(page),
    },
    {
      engine: 'blocking-overlay',
      pageState,
      onFailureMessage: 'Overlay detection failed; continuing with other engines.',
      run: async () => detectBlockingOverlays(page),
    },
  ]);

  return {
    findings: tagFindingsWithPageState(result.findings, pageState),
    report: result.report.map((entry) => ({
      ...entry,
      pageState,
    })),
  };
}

export async function runOverlayAccessibilityEngines(
  page: Page,
  overlays: OverlayCandidate[],
  pageState: PageState,
): Promise<EngineRunResult<RawFinding[]>> {
  const findings: RawFinding[] = [];
  const report: EngineRunSummary[] = [];

  for (const overlay of overlays) {
    findings.push(overlayReviewFinding(overlay));
    const result = await runEngineSeries([
      {
        engine: 'axe',
        pageState,
        onFailureMessage: 'Overlay axe execution failed; continuing with other engines.',
        run: async () => runAxe(page, overlay.selector),
      },
    ]);
    findings.push(...result.findings);
    report.push(...result.report);
  }

  return {
    findings: tagFindingsWithPageState(findings, pageState),
    report: report.map((entry) => ({
      ...entry,
      pageState,
    })),
  };
}

export async function runSupportingEngines(_url: string, _port: number, _pageState: PageState = 'post_overlay'): Promise<EngineRunResult<RawFinding[]>> {
  // Lighthouse and Pa11y are run before the Playwright browser opens in scanner.ts to
  // prevent concurrent Chrome processes from crashing each other under memory pressure.
  return { findings: [], report: [] };
}

const MAX_ELEMENT_SCREENSHOTS = 20;

export async function enrichAndCapture(page: Page, grouped: GroupedFinding[]) {
  const formattedViolations: any[] = [];
  let violationIndex = 0;
  let screenshotsTaken = 0;

  for (const finding of grouped) {
    violationIndex++;
    const selector = finding.selectors[0] || 'document';
    let screenshotUrl = '';

    if (screenshotsTaken < MAX_ELEMENT_SCREENSHOTS) {
      try {
        const locator = page.locator(selector).first();
        await locator.evaluate((el) => {
          el.style.outline = '3px solid #D3141A';
          el.style.outlineOffset = '2px';
          el.scrollIntoView({ behavior: 'auto', block: 'center' });
        });

        const buffer = await locator.screenshot({ timeout: 2000 });
        screenshotUrl = await uploadEvidence(`scan-${Date.now()}-${violationIndex}.png`, buffer, 'image/png');
        screenshotsTaken++;

        await locator.evaluate((el) => {
          el.style.outline = '';
          el.style.outlineOffset = '';
        });
      } catch {
        try {
          const buffer = await page.screenshot({ fullPage: false });
          screenshotUrl = await uploadEvidence(`scan-${Date.now()}-${violationIndex}.png`, buffer, 'image/png');
          screenshotsTaken++;
        } catch {
        }
      }
    }

    const ruleDetails = getRuleDetails(finding.normalizedRuleId || finding.ruleId);
    const effectiveCriterion = finding.wcagCriterion || ruleDetails.criterion || 'Otros';
    const effectiveLevel = finding.wcagLevel || ruleDetails.level || 'A';
    const findingStatus = finding.findingStatus || ruleDetails.findingStatus || (finding.category === 'violation' ? 'confirmed' : 'needs_review');
    const suggestedFix = ruleDetails.suggestedFix || finding.suggestedFixes[0] || 'Revisar manualmente el hallazgo y determinar la correccion segun WCAG.';
    const resolutionArticle = resolveLegalReference(effectiveCriterion, ruleDetails.resolutionArticle);

    const classification = enforceClassification({
      category: finding.category,
      selector,
      elementHtml: finding.elements[0] || '',
      wcagCriterion: effectiveCriterion,
      detectedBy: finding.tools,
      normalizedRuleId: finding.normalizedRuleId,
    });

    const manualGuidance = buildManualGuidance({
      category: classification.category,
      wcagCriterion: effectiveCriterion,
      wcagLevel: effectiveLevel === 'N/A' ? undefined : effectiveLevel,
      normalizedRuleId: finding.normalizedRuleId,
      description: finding.description,
      selector,
      elementHtml: finding.elements[0] || '',
    });

    formattedViolations.push({
      ruleId: finding.ruleId,
      normalizedRuleId: finding.normalizedRuleId,
      sourceCategory: classification.category,
      classificationConfidence: classification.confidence,
      classificationReason: classification.reason,
      wcagCriterion: effectiveCriterion,
      wcagLevel: effectiveLevel,
      criterion: effectiveCriterion,
      nameEs: ruleDetails.nameEs,
      level: effectiveLevel,
      disability: ruleDetails.disability,
      role: ruleDetails.role,
      severity: finding.severity,
      findingStatus,
      status: findingStatus,
      statusLabel: resolveStatusLabel(findingStatus),
      pageState: finding.pageState || 'post_overlay',
      pageStateLabel: finding.pageState ? labelPageState(finding.pageState) : labelPageState('post_overlay'),
      description: finding.description,
      elementHtml: finding.elements[0] || '',
      selector,
      screenshotUrl,
      suggestedFix,
      resolutionArticle,
      wcagUrl: ruleDetails.wcagUrl,
      detectedBy: finding.tools,
      rootCauseKey: finding.normalizedRuleId,
      affectedElements: finding.selectors,
      affectedHtmlSamples: finding.elements,
      manualGuidance,
    });
  }

  return formattedViolations;
}
