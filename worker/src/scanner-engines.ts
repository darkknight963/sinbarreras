import axeCore from 'axe-core';
import { Page } from 'playwright';
import { buildManualGuidance } from './manualGuidanceBuilder.js';
import { enforceClassification } from './classificationPolicy.js';
import { getRuleDetails } from './wcagRules.js';
import { uploadEvidence } from './storage.js';
import type {
  EngineRunResult,
  EngineRunSummary,
  FindingCategory,
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

export async function handleCommonOverlays(page: Page) {
  const candidates = [
    'button:has-text("Aceptar")',
    'button:has-text("Acepto")',
    'button:has-text("Acepto los tÃ©rminos")',
    'button:has-text("Aceptar tÃ©rminos")',
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
      } catch {
      }
    }
  }
}

async function detectBlockingOverlays(page: Page): Promise<RawFinding[]> {
  const overlays = await page.evaluate(`(() => {
    const candidates = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], .modal, .modal-dialog, [aria-modal="true"]'));
    const visible = candidates
      .filter((el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 120 && rect.height > 80;
      })
      .slice(0, 3)
      .map((el) => {
        const id = el.id ? '#' + el.id : '';
        const selector = id || (el.className ? '.' + String(el.className).trim().split(/\\s+/).join('.') : el.tagName.toLowerCase());
        return { selector, html: el.outerHTML.slice(0, 1000) };
      });
    return visible;
  })()`) as Array<{ selector: string; html: string }>;

  return overlays.map((overlay) => ({
    tool: 'heuristic-dom',
    ruleId: 'blocking-overlay-needs-review',
    normalizedRuleId: 'blocking-overlay-needs-review',
    category: 'manual_check',
    wcagCriterion: 'Revision manual',
    findingStatus: 'needs_review',
    description: 'Se detecto un modal o bloqueo visible que puede limitar la cobertura del analisis automatico.',
    selector: normalizeSelector(overlay.selector),
    elementHtml: overlay.html,
    severity: 'medio',
    suggestedFix: 'Revisar el sitio en navegador, cerrar o aceptar terminos cuando corresponda, o configurar un script de pre-navegacion seguro para preparar la pagina antes del escaneo.',
  }));
}

async function runAxe(page: Page): Promise<RawFinding[]> {
  await page.evaluate((src) => {
    const script = window.document.createElement('script');
    script.innerHTML = src;
    window.document.head.appendChild(script);
  }, axeSource);

  const results = await page.evaluate(() => {
    // @ts-ignore
    return axe.run({
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag22a', 'wcag22aa', 'wcag22aaa', 'best-practice'],
      },
    });
  });

  const findings: RawFinding[] = [];
  for (const violation of results.violations || []) {
    for (const node of violation.nodes || []) {
      const selector = Array.isArray(node.target) ? node.target.join(' ') : 'document';
      const fix = (node.any || []).map((item: any) => item.message).join('. ') || 'Asegurar cumplimiento WCAG.';
      findings.push({
        tool: 'axe',
        ruleId: violation.id || 'axe-unknown',
        normalizedRuleId: normalizeRuleId(violation.id || 'axe-unknown', violation.description || violation.help || ''),
        category: 'violation',
        ...parseWcagTags(violation.tags),
        description: violation.description || violation.help || 'Violacion detectada por axe-core',
        selector: normalizeSelector(selector),
        elementHtml: node.html || '',
        severity: toSeverityEs(violation.impact),
        suggestedFix: fix,
      });
    }
  }

  return findings;
}

async function runLighthouse(url: string, port: number): Promise<RawFinding[]> {
  const lighthouseModule: any = await import('lighthouse');
  const lighthouse = lighthouseModule.default || lighthouseModule;
  const report = await lighthouse(url, {
    port,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['accessibility'],
    disableStorageReset: true,
  });

  const lhr = report?.lhr;
  const audits = lhr?.audits || {};
  const findings: RawFinding[] = [];

  for (const [auditId, audit] of Object.entries<any>(audits)) {
    const score = typeof audit?.score === 'number' ? audit.score : 1;
    if (score >= 1) continue;

    const details = audit?.details;
    const items = Array.isArray(details?.items) ? details.items : [{}];

    for (const item of items) {
      const selector = normalizeSelector(item?.node?.selector || item?.selector || 'document');
      const html = item?.node?.snippet || item?.node?.explanation || '';
      findings.push({
        tool: 'lighthouse',
        ruleId: String(auditId),
        normalizedRuleId: normalizeRuleId(String(auditId), audit?.title || audit?.description || ''),
        category: toCategoryFromLighthouse(audit),
        description: audit?.title || audit?.description || 'Hallazgo de Lighthouse',
        selector,
        elementHtml: html,
        severity: score <= 0.3 ? 'alto' : score <= 0.6 ? 'medio' : 'bajo',
        suggestedFix: audit?.description || 'Revisar recomendacion de Lighthouse.',
      });
    }
  }

  return findings;
}

async function runPa11y(url: string, port: number): Promise<RawFinding[]> {
  const pa11yModule: any = await import('pa11y' as any);
  const pa11y = pa11yModule.default || pa11yModule;
  const puppeteerModule: any = await import('puppeteer-core');
  const puppeteer = puppeteerModule.default || puppeteerModule;

  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const result = await pa11y(url, {
      browser,
      page,
      ignoreUrl: true,
      standard: 'WCAG2AA',
      runners: ['axe', 'htmlcs'],
      includeWarnings: true,
      includeNotices: false,
      timeout: 30000,
      wait: 1000,
    });

    const findings: RawFinding[] = [];
    for (const issue of result?.issues || []) {
      findings.push({
        tool: 'pa11y',
        ruleId: issue.code || 'pa11y-unknown',
        normalizedRuleId: normalizeRuleId(issue.code || 'pa11y-unknown', issue.message || ''),
        category: issue.typeCode === 1 ? 'violation' : 'alert',
        description: issue.message || 'Hallazgo de Pa11y',
        selector: normalizeSelector(issue.selector || 'document'),
        elementHtml: issue.context || '',
        severity: toSeverityEs(issue.type || issue.typeCode),
        suggestedFix: issue.runner ? `Revisar regla ${issue.runner}:${issue.code}` : 'Revisar hallazgo de Pa11y.',
      });
    }

    return findings;
  } finally {
    await page.close().catch(() => { });
    await browser.disconnect().catch(() => { });
  }
}

async function runIbmEqualAccess(page: Page): Promise<RawFinding[]> {
  const checkerModule: any = await import('accessibility-checker');
  const aChecker = checkerModule.default || checkerModule;
  const html = await page.content();
  const report = await aChecker.getCompliance(html, 'scan-page');

  const violations = report?.results?.violations || [];
  const needsReview = report?.results?.needsReview || [];
  const findings: RawFinding[] = [];

  for (const v of violations) {
    const path = Array.isArray(v?.path) ? v.path[0] : undefined;
    const selector = normalizeSelector(path?.dom || path?.target || 'document');
    findings.push({
      tool: 'ibm-equal-access',
      ruleId: v?.ruleId || v?.id || 'ibm-unknown',
      normalizedRuleId: normalizeRuleId(v?.ruleId || v?.id || 'ibm-unknown', v?.message || v?.reasonId || ''),
      category: 'violation',
      description: v?.message || v?.reasonId || 'Hallazgo de IBM Equal Access',
      selector,
      elementHtml: path?.snippet || '',
      severity: toSeverityEs(v?.level || v?.impact),
      suggestedFix: v?.help || 'Revisar recomendacion de IBM Equal Access.',
    });
  }

  for (const v of needsReview) {
    const path = Array.isArray(v?.path) ? v.path[0] : undefined;
    const selector = normalizeSelector(path?.dom || path?.target || 'document');
    findings.push({
      tool: 'ibm-equal-access',
      ruleId: v?.ruleId || v?.id || 'ibm-needs-review',
      normalizedRuleId: normalizeRuleId(v?.ruleId || v?.id || 'ibm-needs-review', v?.message || v?.reasonId || ''),
      category: 'manual_check',
      description: v?.message || v?.reasonId || 'Revision manual recomendada por IBM Equal Access',
      selector,
      elementHtml: path?.snippet || '',
      severity: 'medio',
      suggestedFix: v?.help || 'Validar manualmente el criterio en el contexto funcional.',
    });
  }

  return findings;
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
    suggestedFix: 'Validar y corregir estructura semantica y etiquetado accesible segun WCAG.',
  }));
}

export async function runStatefulPageEngines(page: Page, pageState: PageState): Promise<EngineRunResult<RawFinding[]>> {
  const startedAt = Date.now();
  const result = await runEngineSeries([
    {
      engine: 'axe',
      pageState,
      onFailureMessage: 'Axe execution failed; continuing with other engines.',
      run: async () => runAxe(page),
    },
    {
      engine: 'ibm-equal-access',
      pageState,
      onFailureMessage: 'IBM Equal Access execution failed; continuing with other engines.',
      run: async () => runIbmEqualAccess(page),
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

export async function runSupportingEngines(url: string, port: number): Promise<EngineRunResult<RawFinding[]>> {
  const result = await runEngineSeries([
    {
      engine: 'lighthouse',
      pageState: 'post_overlay',
      onFailureMessage: 'Lighthouse execution failed; continuing with other engines.',
      run: async () => runLighthouse(url, port),
    },
    {
      engine: 'pa11y',
      pageState: 'post_overlay',
      onFailureMessage: 'Pa11y execution failed; continuing with other engines.',
      run: async () => runPa11y(url, port),
    },
  ]);

  return {
    findings: tagFindingsWithPageState(result.findings, 'post_overlay'),
    report: result.report,
  };
}

export async function enrichAndCapture(page: Page, grouped: GroupedFinding[]) {
  const formattedViolations: any[] = [];
  let violationIndex = 0;

  for (const finding of grouped) {
    violationIndex++;
    const selector = finding.selectors[0] || 'document';
    let screenshotUrl = '';

    try {
      const locator = page.locator(selector).first();
      await locator.evaluate((el) => {
        el.style.outline = '3px solid #D3141A';
        el.style.outlineOffset = '2px';
        el.scrollIntoView({ behavior: 'auto', block: 'center' });
      });

      const buffer = await locator.screenshot({ timeout: 2000 });
      screenshotUrl = await uploadEvidence(`scan-${Date.now()}-${violationIndex}.png`, buffer, 'image/png');

      await locator.evaluate((el) => {
        el.style.outline = '';
        el.style.outlineOffset = '';
      });
    } catch {
      try {
        const buffer = await page.screenshot({ fullPage: false });
        screenshotUrl = await uploadEvidence(`scan-${Date.now()}-${violationIndex}.png`, buffer, 'image/png');
      } catch {
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
