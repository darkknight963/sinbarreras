import { chromium, Page } from 'playwright';
import { createServer } from 'net';
import axeCore from 'axe-core';
import { getRuleDetails } from './wcagRules.js';
import { uploadEvidence } from './storage.js';
import { runPeruvianChecks } from './peruvianChecks.js';
import { enforceClassification } from './classificationPolicy.js';
import { buildManualGuidance } from './manualGuidanceBuilder.js';
import { buildCoverageReport } from './coverageReport.js';
import { detectPageContent } from './content-detector.js';
import { buildApplicability, conservativeApplicability, summarizeApplicability } from './wcag-applicability.js';

const axeSource = axeCore.source;
declare const document: any;
declare const window: any;

type SeverityEs = 'critico' | 'alto' | 'medio' | 'bajo';
type FindingCategory = 'violation' | 'alert' | 'manual_check';
type FindingTool = 'axe' | 'lighthouse' | 'pa11y' | 'ibm-equal-access' | 'heuristic-dom';
type FindingStatus = 'confirmed' | 'needs_review' | 'not_evaluated' | 'not_applicable';
type PageState = 'initial' | 'post_overlay';

interface RawFinding {
  tool: FindingTool;
  ruleId: string;
  normalizedRuleId: string;
  category: FindingCategory;
  wcagCriterion?: string;
  wcagLevel?: 'A' | 'AA' | 'AAA';
  findingStatus?: FindingStatus;
  pageState?: PageState;
  description: string;
  selector: string;
  elementHtml: string;
  severity: SeverityEs;
  suggestedFix: string;
}

interface GroupedFinding {
  ruleId: string;
  normalizedRuleId: string;
  category: FindingCategory;
  wcagCriterion?: string;
  wcagLevel?: 'A' | 'AA' | 'AAA';
  findingStatus?: FindingStatus;
  pageState?: PageState;
  description: string;
  severity: SeverityEs;
  selectors: string[];
  elements: string[];
  tools: FindingTool[];
  suggestedFixes: string[];
}

export interface ScanOptions {
  viewport?: { width: number; height: number };
  preNavigationScript?: string;
  onProgress?: (progress: number) => Promise<void> | void;
}

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

function toSeverityEs(value?: string | null): SeverityEs {
  const normalized = (value || '').toLowerCase();
  if (normalized.includes('critical')) return 'critico';
  if (normalized.includes('serious') || normalized.includes('high') || normalized.includes('error')) return 'alto';
  if (normalized.includes('moderate') || normalized.includes('warning') || normalized.includes('medium')) return 'medio';
  return 'bajo';
}

function rankSeverity(value: SeverityEs): number {
  if (value === 'critico') return 4;
  if (value === 'alto') return 3;
  if (value === 'medio') return 2;
  return 1;
}

function normalizeSelector(selector: string): string {
  return (selector || '').trim() || 'document';
}

function normalizeCause(ruleId: string, description: string, pageState?: PageState): string {
  return `${pageState || 'page'}::${(ruleId || 'unknown').trim().toLowerCase()}::${(description || '').trim().toLowerCase()}`;
}

function normalizeRuleId(ruleId: string, description: string): string {
  const r = (ruleId || '').toLowerCase();
  const d = (description || '').toLowerCase();

  if (r.includes('duplicate-id') || d.includes('id attribute is not unique')) return 'duplicate-id';
  if (r.includes('aria-dialog-name') || d.includes('dialog') && d.includes('accessible name')) return 'aria-dialog-name';
  if (r.includes('aria-valid-attr-value') || d.includes('aria attributes') && d.includes('valid values')) return 'aria-valid-attr-value';
  if (r.includes('scrollable-region-focusable') || d.includes('scrollable region') && d.includes('keyboard')) return 'scrollable-region-focusable';
  if (r.includes('frame-tested')) return 'frame-tested';
  if (r.includes('region') || d.includes('contained by landmarks')) return 'region';
  if (r.includes('main') && (r.includes('landmark') || d.includes('main landmark'))) return 'landmark-main-missing';
  if (r.includes('nav') && (r.includes('landmark') || d.includes('navigation'))) return 'landmark-nav-missing';
  if (r.includes('bypass') || d.includes('skip to main') || d.includes('bypass blocks')) return 'bypass-missing';
  if (r.includes('multiple-labels') || r.includes('label') && d.includes('more than one')) return 'form-control-multiple-labels';
  if (r.includes('form-field-multiple-labels')) return 'form-control-multiple-labels';
  if (r.includes('label') && d.includes('empty')) return 'label-empty-text';
  if (d.includes('autocomplete') && d.includes('missing')) return 'autocomplete-missing';
  if (r.includes('required-html5-attribute') || d.includes('required') && d.includes('html5')) return 'required-html5-indicator';
  if (d.includes('contrast') && d.includes('image background')) return 'contrast-image-background-undetermined';
  if (r.includes('f24.fgcolour') || d.includes('inherited background colour')) return 'contrast-image-background-undetermined';
  if (d.includes('checkbox') && d.includes('no text in label')) return 'checkbox-label-missing';
  if (r.includes('h91.select.value')) return 'select-value';
  if (r.includes('h85.2')) return 'select-optgroup';
  if (r.includes('h44.notformcontrol')) return 'label-not-form-control';
  if (r.includes('h39.3.nocaption')) return 'table-caption-review';
  if (r.includes('h67.2')) return 'image-ignored-review';
  if (r.includes('1_4_10')) return 'reflow-fixed-position';
  if (r.includes('h42')) return 'heading-markup-review';
  if (r.includes('h91.textarea.name')) return 'textarea-name';
  if (r.includes('f68')) return 'form-field-label-missing';
  if (r.includes('h64.1')) return 'iframe-title';

  return (ruleId || 'unknown').trim().toLowerCase();
}

function parseWcagTags(tags: string[] | undefined): { criterion?: string; level?: 'A' | 'AA' | 'AAA' } {
  if (!tags || !tags.length) return {};
  const wcagTag = tags.find((t) => /^wcag\d{3,4}$/.test(t));
  const levelTag = tags.find((t) => t === 'wcag2a' || t === 'wcag2aa' || t === 'wcag2aaa' || t === 'wcag22a' || t === 'wcag22aa' || t === 'wcag22aaa');
  const criterion = wcagTag ? `${wcagTag[4]}.${wcagTag[5]}.${wcagTag.slice(6)}` : undefined;
  const level = levelTag?.endsWith('aaa') ? 'AAA' : levelTag?.endsWith('aa') ? 'AA' : levelTag?.endsWith('a') ? 'A' : undefined;
  return { criterion, level };
}

function toCategoryFromLighthouse(audit: any): FindingCategory {
  if (audit?.scoreDisplayMode === 'manual') return 'manual_check';
  if (audit?.scoreDisplayMode === 'informative') return 'alert';
  return 'alert';
}

async function handleCommonOverlays(page: Page) {
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
  try {
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
  } catch (err) {
    console.warn('Lighthouse execution failed; continuing with other engines.', err);
    return [];
  }
}

async function runPa11y(url: string, port: number): Promise<RawFinding[]> {
  try {
    const pa11yModule: any = await import('pa11y' as any);
    const pa11y = pa11yModule.default || pa11yModule;
    const puppeteerModule: any = await import('puppeteer-core');
    const puppeteer = puppeteerModule.default || puppeteerModule;

    const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
    const page = await browser.newPage();
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

    await page.close();
    await browser.disconnect();

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
  } catch (err) {
    console.warn('Pa11y execution failed; continuing with other engines.', err);
    return [];
  }
}

async function runIbmEqualAccess(page: Page): Promise<RawFinding[]> {
  try {
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
  } catch (err) {
    console.warn('IBM Equal Access execution failed; continuing with other engines.', err);
    return [];
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

function labelPageState(state: PageState): string {
  return state === 'initial' ? 'Estado inicial' : 'Despues de cerrar modales';
}

function tagFindingsWithPageState(findings: RawFinding[], pageState: PageState): RawFinding[] {
  const label = labelPageState(pageState);
  return findings.map((finding) => ({
    ...finding,
    pageState,
    description: `[${label}] ${finding.description}`,
  }));
}

async function runStatefulPageEngines(page: Page, pageState: PageState): Promise<RawFinding[]> {
  const [axeFindings, ibmFindings, heuristicFindings, overlayFindings] = await Promise.all([
    runAxe(page),
    runIbmEqualAccess(page),
    runHeuristicDomChecks(page),
    detectBlockingOverlays(page),
  ]);

  return tagFindingsWithPageState([
    ...axeFindings,
    ...ibmFindings,
    ...heuristicFindings,
    ...overlayFindings,
  ], pageState);
}

function dedupeByRuleAndSelector(findings: RawFinding[]): RawFinding[] {
  const map = new Map<string, RawFinding>();

  for (const finding of findings) {
    const key = `${finding.pageState || 'page'}::${finding.normalizedRuleId}::${normalizeSelector(finding.selector)}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, finding);
      continue;
    }

    if (rankSeverity(finding.severity) > rankSeverity(existing.severity)) {
      map.set(key, finding);
    }
  }

  return Array.from(map.values());
}

function groupFindings(findings: RawFinding[]): GroupedFinding[] {
  const map = new Map<string, GroupedFinding>();

  for (const f of findings) {
    const key = normalizeCause(f.normalizedRuleId, f.description, f.pageState);
    const current = map.get(key);

    if (!current) {
      map.set(key, {
        ruleId: f.ruleId,
        normalizedRuleId: f.normalizedRuleId,
        category: f.category,
        wcagCriterion: f.wcagCriterion,
        wcagLevel: f.wcagLevel,
        findingStatus: f.findingStatus,
        pageState: f.pageState,
        description: f.description,
        severity: f.severity,
        selectors: [normalizeSelector(f.selector)],
        elements: f.elementHtml ? [f.elementHtml] : [],
        tools: [f.tool],
        suggestedFixes: f.suggestedFix ? [f.suggestedFix] : [],
      });
      continue;
    }

    if (rankSeverity(f.severity) > rankSeverity(current.severity)) {
      current.severity = f.severity;
    }

    if (current.category !== 'violation' && f.category === 'violation') current.category = 'violation';
    if (current.category === 'manual_check' && f.category === 'alert') current.category = 'alert';
    if (!current.wcagCriterion && f.wcagCriterion) current.wcagCriterion = f.wcagCriterion;
    if (!current.wcagLevel && f.wcagLevel) current.wcagLevel = f.wcagLevel;
    if (!current.findingStatus && f.findingStatus) current.findingStatus = f.findingStatus;
    if (!current.pageState && f.pageState) current.pageState = f.pageState;

    const s = normalizeSelector(f.selector);
    if (!current.selectors.includes(s)) current.selectors.push(s);
    if (f.elementHtml && !current.elements.includes(f.elementHtml)) current.elements.push(f.elementHtml);
    if (!current.tools.includes(f.tool)) current.tools.push(f.tool);
    if (f.suggestedFix && !current.suggestedFixes.includes(f.suggestedFix)) current.suggestedFixes.push(f.suggestedFix);
  }

  return Array.from(map.values());
}

function isSpecificCriterion(value?: string): value is string {
  return !!value && value !== 'Otros' && value !== 'Revision manual';
}

function resolveLegalReference(criterion: string, fallback: string): string {
  if (isSpecificCriterion(criterion)) return `Anexo 1 - Criterio ${criterion}`;
  return fallback;
}

function resolveStatusLabel(status: FindingStatus): string {
  if (status === 'confirmed') return 'Confirmado';
  if (status === 'not_evaluated') return 'No evaluado';
  if (status === 'not_applicable') return 'No aplicable';
  return 'Requiere revision';
}

async function enrichAndCapture(page: Page, grouped: GroupedFinding[]) {
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

export async function scanUrl(url: string, options: ScanOptions = {}) {
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
    console.log(`Navigating to: ${url}`);
    await reportProgress(5);
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
    const initialFindings = await runStatefulPageEngines(page, 'initial');
    await reportProgress(35);

    await handleCommonOverlays(page);
    await page.waitForLoadState('networkidle').catch(() => { });
    try {
      const contentDetection = await detectPageContent(page);
      applicability = buildApplicability(contentDetection);
    } catch (err) {
      console.warn('Content applicability detection after modal handling failed; keeping previous applicability state.', err);
    }

    if (options.preNavigationScript) {
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
    const [postOverlayFindings, lighthouseFindings, pa11yFindings] = await Promise.all([
      runStatefulPageEngines(page, 'post_overlay'),
      runLighthouse(url, debugPort),
      runPa11y(url, debugPort),
    ]);
    await reportProgress(65);

    const mergedRaw = [
      ...initialFindings,
      ...postOverlayFindings,
      ...tagFindingsWithPageState([...lighthouseFindings, ...pa11yFindings], 'post_overlay'),
    ];
    const coverageReport = buildCoverageReport(mergedRaw);
    const dedupedRaw = dedupeByRuleAndSelector(mergedRaw);
    const grouped = groupFindings(dedupedRaw);
    await reportProgress(75);
    const formattedViolations = await enrichAndCapture(page, grouped);
    await reportProgress(85);

    const failedCriterionIds = new Set(
      formattedViolations
        .filter(v => (v.findingStatus || 'confirmed') === 'confirmed' && isSpecificCriterion(v.criterion))
        .map(v => v.criterion)
    );
    const applicabilitySummary = summarizeApplicability(applicability, failedCriterionIds);
    const score = applicabilitySummary.score;

    let htmlDumpUrl = '';
    try {
      const htmlContent = await page.content();
      htmlDumpUrl = await uploadEvidence(`scan-${Date.now()}-dump.html`, htmlContent, 'text/html');
    } catch (htmlErr) {
      console.error('Failed to capture HTML dump:', htmlErr);
    }

    console.log('Running Peruvian compliance heuristics...');
    const peruvianResults = await runPeruvianChecks(page, url);
    await reportProgress(95);

    return {
      score,
      violations: formattedViolations,
      applicability,
      applicabilitySummary,
      coverageReport,
      peruvianChecks: peruvianResults,
      device: options.viewport?.width === 375 ? 'Movil' : options.viewport?.width === 768 ? 'Tablet' : 'Desktop',
      htmlDumpUrl,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}
