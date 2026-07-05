import type { FindingCategory, FindingStatus, GroupedFinding, PageState, RawFinding, SeverityEs } from './scanner-models.js';

export function toSeverityEs(value?: string | null): SeverityEs {
  const normalized = (value || '').toLowerCase();
  if (normalized.includes('critical')) return 'critico';
  // 'violation' exacto es el nivel de IBM Equal Access para fallas confirmadas
  // (el chequeo exacto evita capturar 'potentialviolation').
  if (normalized === 'violation' || normalized.includes('serious') || normalized.includes('high') || normalized.includes('error')) return 'alto';
  if (
    normalized.includes('potentialviolation') ||
    normalized.includes('recommendation') ||
    normalized.includes('moderate') ||
    normalized.includes('warning') ||
    normalized.includes('medium')
  ) return 'medio';
  return 'bajo';
}

export function rankSeverity(value: SeverityEs): number {
  if (value === 'critico') return 4;
  if (value === 'alto') return 3;
  if (value === 'medio') return 2;
  return 1;
}

export function normalizeSelector(selector: string): string {
  return (selector || '').trim() || 'document';
}

export function normalizeCause(ruleId: string, description: string, pageState?: PageState): string {
  return `${pageState || 'page'}::${(ruleId || 'unknown').trim().toLowerCase()}::${(description || '').trim().toLowerCase()}`;
}

export function normalizeRuleId(ruleId: string, description: string): string {
  const r = (ruleId || '').toLowerCase();
  const d = (description || '').toLowerCase();

  if (r.includes('duplicate-id') || d.includes('id attribute is not unique')) return 'duplicate-id';
  if (r.includes('html-lang-missing') || (d.includes('html') && d.includes('lang'))) return 'html-lang-missing';
  if (r.includes('aria-dialog-name') || (d.includes('dialog') && d.includes('accessible name'))) return 'aria-dialog-name';
  if (r.includes('aria-widget-name-missing') || (d.includes('aria') && d.includes('accessible name'))) return 'aria-widget-name-missing';
  if (r.includes('aria-required-owned-element') || d.includes('required owned') || d.includes('owned element')) return 'aria-required-owned-element';
  if (r.includes('aria-valid-attr-value') || (d.includes('aria attributes') && d.includes('valid values'))) return 'aria-valid-attr-value';
  if (r.includes('scrollable-region-focusable') || (d.includes('scrollable region') && d.includes('keyboard'))) return 'scrollable-region-focusable';
  if (r.includes('h1-in-header') || (d.includes('h1') && d.includes('header'))) return 'h1-in-header';
  if (r.includes('content-behind-dialog-accessible') || (d.includes('content behind') && d.includes('dialog')) || (d.includes('contenido detras') && d.includes('dialogo'))) return 'content-behind-dialog-accessible';
  if (r.includes('frame-tested')) return 'frame-tested';
  if (r.includes('region') || d.includes('contained by landmarks')) return 'region';
  if (r.includes('main') && (r.includes('landmark') || d.includes('main landmark'))) return 'landmark-main-missing';
  if (r.includes('nav') && (r.includes('landmark') || d.includes('navigation'))) return 'landmark-nav-missing';
  if (r.includes('bypass') || d.includes('skip to main') || d.includes('bypass blocks')) return 'bypass-missing';
  if (r.includes('empty-list-item') || (d.includes('list') && d.includes('empty'))) return 'empty-list-item';
  if (r.includes('link-href-missing') || d.includes('missing href')) return 'link-href-missing';
  if (r.includes('link-name-missing') || (d.includes('link') && (d.includes('no text') || d.includes('discernible text') || d.includes('accessible name')))) return 'link-name-missing';
  if (r.includes('button-name-missing') || (d.includes('button') && (d.includes('label') || d.includes('accessible name') || d.includes('programmatic name')))) return 'button-name-missing';
  if (r.includes('input-name-missing') || (d.includes('input') && d.includes('accessible name'))) return 'input-name-missing';
  if (r.includes('multiple-labels') || (r.includes('label') && d.includes('more than one'))) return 'form-control-multiple-labels';
  if (r.includes('form-field-multiple-labels')) return 'form-control-multiple-labels';
  if (r.includes('label') && d.includes('empty')) return 'label-empty-text';
  if (d.includes('autocomplete') && d.includes('missing')) return 'autocomplete-missing';
  if (r.includes('required-html5-attribute') || (d.includes('required') && d.includes('html5'))) return 'required-html5-indicator';
  if (d.includes('contrast') && d.includes('image background')) return 'contrast-image-background-undetermined';
  if (r.includes('table-purpose-review') || d.includes('unknown table') || d.includes('determine if the table')) return 'table-purpose-review';
  if (r.includes('title-non-interactive') || (d.includes('title') && d.includes('non-interactive'))) return 'title-non-interactive';
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

export function parseWcagTags(tags: string[] | undefined): { criterion?: string; level?: 'A' | 'AA' | 'AAA' } {
  if (!tags || !tags.length) return {};
  const wcagTag = tags.find((t) => /^wcag\d{3,4}$/.test(t));
  const levelTag = tags.find((t) => t === 'wcag2a' || t === 'wcag2aa' || t === 'wcag2aaa' || t === 'wcag22a' || t === 'wcag22aa' || t === 'wcag22aaa');
  const criterion = wcagTag ? `${wcagTag[4]}.${wcagTag[5]}.${wcagTag.slice(6)}` : undefined;
  const level = levelTag?.endsWith('aaa') ? 'AAA' : levelTag?.endsWith('aa') ? 'AA' : levelTag?.endsWith('a') ? 'A' : undefined;
  return { criterion, level };
}

export function toCategoryFromLighthouse(audit: any): FindingCategory {
  if (audit?.scoreDisplayMode === 'manual') return 'manual_check';
  if (audit?.scoreDisplayMode === 'informative') return 'alert';
  return 'alert';
}

export function labelPageState(state: PageState): string {
  if (state === 'initial') return 'Estado inicial';
  if (state === 'interactive_state') return 'Estado interactivo';
  return 'Después de cerrar modales';
}

export function tagFindingsWithPageState(findings: RawFinding[], pageState: PageState): RawFinding[] {
  return findings.map((finding) => ({
    ...finding,
    pageState,
  }));
}

export function dedupeByRuleAndSelector(findings: RawFinding[]): RawFinding[] {
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

export function groupFindings(findings: RawFinding[]): GroupedFinding[] {
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

export function isSpecificCriterion(value?: string): value is string {
  return !!value && value !== 'Otros' && value !== 'Revision manual';
}

export function resolveLegalReference(criterion: string, fallback: string): string {
  if (isSpecificCriterion(criterion)) return `Anexo 1 - Criterio ${criterion}`;
  return fallback;
}

export function resolveStatusLabel(status: FindingStatus): string {
  if (status === 'confirmed') return 'Confirmado';
  if (status === 'not_evaluated') return 'No evaluado';
  if (status === 'not_applicable') return 'No aplicable';
  return 'Requiere revisión';
}
