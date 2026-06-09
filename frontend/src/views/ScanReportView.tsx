import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Download,
  FileText,
  Gauge,
  Lock,
  ListTree,
  TableProperties,
} from 'lucide-react';

const SESSION_STORAGE_KEY = 'sin-barreras-session-token';

const getStoredAuthToken = () =>
  typeof window === 'undefined' ? '' : (window.localStorage.getItem(SESSION_STORAGE_KEY)?.trim() || '');

const withAuthHeaders = (headers?: HeadersInit): HeadersInit => {
  const nextHeaders = new Headers(headers);
  const token = getStoredAuthToken();
  if (token) {
    nextHeaders.set('Authorization', `Bearer ${token}`);
  }
  return nextHeaders;
};

function EvidencePreview({ url }: { url: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let generatedUrl: string | null = null;

    const loadEvidence = async () => {
      try {
        const response = await fetch(url, {
          headers: withAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error(`Evidence fetch failed: ${response.status}`);
        }

        const blob = await response.blob();
        generatedUrl = URL.createObjectURL(blob);

        if (active) {
          setObjectUrl(generatedUrl);
        }
      } catch {
        if (active) {
          setObjectUrl(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    setObjectUrl(null);
    loadEvidence();

    return () => {
      active = false;
      if (generatedUrl) {
        URL.revokeObjectURL(generatedUrl);
      }
    };
  }, [url]);

  if (loading) {
    return <div className="report-no-evidence">Cargando evidencia visual...</div>;
  }

  if (!objectUrl) {
    return <div className="report-no-evidence">Sin evidencia visual disponible</div>;
  }

  return (
    <a href={objectUrl} target="_blank" rel="noreferrer" className="report-evidence-link">
      <img src={objectUrl} alt="Evidencia visual" className="w-full rounded-lg border border-slate-200" />
    </a>
  );
}
const getFindingReviewKey = (finding: any) =>
  [
    finding?.criterion || '',
    finding?.ruleId || '',
    finding?.selector || '',
    finding?.pageState || '',
  ].join('|');

const getWcagLevelDashboard = (rows: any[]) => {
  const levels = ['A', 'AA', 'AAA'];

  return levels.map((level) => {
    const levelRows = rows.filter((row) => row.nivel === level);
    const applicableRows = levelRows.filter((row) => row.estado === 'aplica');
    const passedRows = applicableRows.filter((row) => row.uiStatus === 'cumple');
    const failedRows = applicableRows.filter((row) => row.uiStatus === 'falla');
    const reviewRows = applicableRows.filter((row) => row.uiStatus === 'revision');
    const percent = applicableRows.length > 0
      ? Math.round((passedRows.length / applicableRows.length) * 100)
      : null;

    return {
      level,
      total: levelRows.length,
      applicable: applicableRows.length,
      passed: passedRows.length,
      failed: failedRows.length,
      review: reviewRows.length,
      percent,
    };
  });
};

function SemanticStructureViewer({ structure }: { structure: any }) {
  const items = Array.isArray(structure?.items) ? structure.items : [];
  const headingItems = items.filter((item: any) => item.kind === 'heading');
  const headingLevelCounts = headingItems.reduce((counts: Record<string, number>, item: any) => {
    const label = String(item.label || (item.level ? `H${item.level}` : '')).toUpperCase();
    if (/^H[1-6]$/.test(label)) {
      counts[label] = (counts[label] || 0) + 1;
    }
    return counts;
  }, {});
  const headingWarnings = headingItems.filter((item: any) => item.status === 'warning').length;
  const headingErrors = headingItems.filter((item: any) => item.status === 'error').length;

  if (!structure || headingItems.length === 0) {
    return (
      <section id="estructura" className="report-panel report-panel-spacious semantic-structure-panel">
        <div className="focus-map-empty">
          <ListTree className="h-5 w-5" aria-hidden="true" />
          <div>
            <h3 className="report-section-title">Indicadores tipo WAVE</h3>
            <p>No se detectaron encabezados H1-H6 visibles para esta página.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="estructura" className="report-panel report-panel-spacious semantic-structure-panel">
      <div className="semantic-structure-header">
        <div>
          <p className="report-kicker">Estructura y orden de lectura</p>
          <h3 className="report-section-title">Indicadores tipo WAVE</h3>
          <p>Inventario de encabezados visibles H1, H2, H3, H4, H5 y H6.</p>
        </div>
      </div>

      <div className="semantic-summary-grid">
        <div><span>Encabezados</span><strong>{headingItems.length}</strong></div>
        {['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].map((level) => (
          <div key={level}><span>{level}</span><strong>{headingLevelCounts[level] ?? 0}</strong></div>
        ))}
        <div><span>Alertas</span><strong>{headingWarnings}</strong></div>
        <div><span>Errores</span><strong>{headingErrors}</strong></div>
      </div>

      <div className="semantic-structure-list">
        {headingItems.map((item: any) => (
          <article key={`${item.index}-${item.kind}-${item.selector}`} className={`semantic-structure-item semantic-structure-${item.status}`}>
            <div className="semantic-structure-marker" aria-hidden="true">
              {item.label}
            </div>
            <div className="semantic-structure-copy">
              <div className="semantic-structure-title-row">
                <h4>{item.accessibleName || item.text || item.label}</h4>
                <span>{item.label}</span>
              </div>
              <p>{item.issue}</p>
              <code>{item.selector}</code>
              {item.status !== 'ok' && <small>{item.suggestedFix}</small>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
const normalizeText = (value?: string) =>
  (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const severityRank: Record<string, number> = {
  critico: 4,
  alto: 3,
  medio: 2,
  bajo: 1,
};

const getSeverityRank = (severity?: string) => severityRank[normalizeText(severity)] || 0;

const getHighestSeverityFinding = (findings: any[]) =>
  [...(findings || [])].sort((a, b) => getSeverityRank(b?.severity) - getSeverityRank(a?.severity))[0] || null;

const getSeverityClass = (severity?: string) => {
  const normalized = normalizeText(severity);
  if (normalized === 'critico' || normalized === 'alto') return 'report-sev-high';
  if (normalized === 'medio') return 'report-sev-medium';
  return 'report-sev-low';
};

const getPageStateLabel = (finding: any) => {
  if (!finding) return '';
  if (finding.pageStateLabel) return finding.pageStateLabel;
  if (finding.pageState === 'initial') return 'Estado inicial';
  if (finding.pageState === 'post_overlay') return 'Después de cerrar modales';
  return 'Vista evaluada';
};

const getUniqueValues = (items: any[], mapper: (item: any) => string | undefined | null) =>
  Array.from(new Set((items || []).map(mapper).filter(Boolean))) as string[];

const splitReportText = (value?: string | null) =>
  String(value || '')
    .split(/\s*\|\s*/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

const looksLikeCodeOrSelector = (value?: string | null) => {
  const text = String(value || '').trim();
  return /<[^>]+>|[#.][A-Za-z0-9_-]+|\b(?:aria-[\w-]+|role=|href=|class=|id=|data-[\w-]+|tabindex=)\b|[{};]/.test(text);
};

const getFindingDisplayDescription = (finding: any, fallback?: string) => {
  const rawDescription = splitReportText(finding?.description)[0];
  if (looksLikeCodeOrSelector(rawDescription)) return rawDescription;
  return finding?.nameEs || rawDescription || fallback || 'Hallazgo de accesibilidad';
};

const formatRepeatedTextSummary = (counts: Map<string, number>) =>
  Array.from(counts.entries())
    .map(([text, count]) => count > 1 ? `${text} (${count} elementos afectados)` : text)
    .join(' | ');

const getAffectedElementsCount = (finding: any) => {
  const selectors = Array.isArray(finding?.affectedElements) ? finding.affectedElements.filter(Boolean).length : 0;
  const samples = Array.isArray(finding?.affectedHtmlSamples) ? finding.affectedHtmlSamples.filter(Boolean).length : 0;
  return Math.max(1, selectors, samples);
};

const getFindingDescriptionSummary = (findings: any[] = [], manualVerifications: any[] = []) => {
  const counts = new Map<string, number>();

  for (const finding of findings || []) {
    const parts = splitReportText(getFindingDisplayDescription(finding));
    if (parts.length === 0) continue;

    const partCounts = new Map<string, number>();
    for (const part of parts) {
      partCounts.set(part, (partCounts.get(part) || 0) + 1);
    }

    const affectedCount = getAffectedElementsCount(finding);
    for (const [part, partCount] of partCounts.entries()) {
      const count = partCounts.size === 1 ? Math.max(partCount, affectedCount) : partCount;
      counts.set(part, (counts.get(part) || 0) + count);
    }
  }

  if (counts.size === 0) {
    for (const manual of manualVerifications || []) {
      for (const part of splitReportText(manual?.description)) {
        counts.set(part, (counts.get(part) || 0) + 1);
      }
    }
  }

  return formatRepeatedTextSummary(counts);
};

const getFindingCountLabel = (groupCount: number, affectedCount: number) => {
  if (affectedCount > groupCount) {
    return `${groupCount} grupos · ${affectedCount} elementos afectados`;
  }
  return `${groupCount} hallazgo${groupCount === 1 ? '' : 's'}`;
};

const getFindingGroupType = (finding: any) => {
  const status = String(finding?.findingStatus || finding?.status || '').toLowerCase();
  if (status === 'confirmed' || status === 'fail' || status === 'failed') return 'error';
  if (status === 'not_applicable' || status === 'pass' || status === 'passed') return 'validado';
  return 'revision';
};

const getFindingGroupBadge = (finding: any, count: number) => {
  const type = getFindingGroupType(finding);
  if (type === 'error') return `${count} error${count === 1 ? '' : 'es'}`;
  if (type === 'validado') return `${count} validado${count === 1 ? '' : 's'}`;
  return `${count} revisión${count === 1 ? '' : 'es'}`;
};

const getFindingStatusSummaryItems = (findings: any[] = []) => {
  const counts = { error: 0, revision: 0, validado: 0 };

  for (const finding of findings || []) {
    const type = getFindingGroupType(finding);
    counts[type as keyof typeof counts] += 1;
  }

  return [
    {
      key: 'error',
      count: counts.error,
      label: `${counts.error} confirmado${counts.error === 1 ? '' : 's'}`,
      className: 'report-status-failed',
    },
    {
      key: 'revision',
      count: counts.revision,
      label: `${counts.revision} en revisión`,
      className: 'report-status-pending',
    },
    {
      key: 'validado',
      count: counts.validado,
      label: `${counts.validado} validado${counts.validado === 1 ? '' : 's'}`,
      className: 'report-status-approved',
    },
  ].filter((item) => item.count > 0);
};

const getPrimaryFindingMessage = (finding: any, fallback?: string) => {
  const parts = splitReportText(finding?.description || finding?.nameEs || finding?.ruleId || fallback);
  return parts[0] || finding?.nameEs || finding?.ruleId || fallback || 'Hallazgo sin descripcion';
};

const stripFindingStatePrefix = (value: string) =>
  value.replace(/^\[[^\]]+\]\s*/g, '').replace(/\s*\(https?:\/\/[^\s)]+\)\s*/gi, '').trim();

const getFriendlyFindingTitle = (finding: any, fallback?: string) => {
  const rawMessage = stripFindingStatePrefix(getPrimaryFindingMessage(finding, fallback));
  const text = normalizeText([rawMessage, finding?.ruleId, finding?.nameEs, fallback].filter(Boolean).join(' '));

  if (text.includes('color contrast') || text.includes('contrast ratio') || text.includes('contraste')) {
    return 'Contraste de color insuficiente';
  }
  if (text.includes('form field') && text.includes('label')) {
    return 'Campo de formulario sin etiqueta accesible';
  }
  if (text.includes('no label for button') || (text.includes('button') && text.includes('programmatic name'))) {
    return 'Botón sin nombre accesible';
  }
  if (text.includes('input has no accessible name') || text.includes('accessible name')) {
    return 'Control sin nombre accesible';
  }
  if (text.includes('aria-labelledby') || text.includes('missing id') || text.includes('invalid aria')) {
    return 'Referencia ARIA inválida';
  }
  if (text.includes('required owned') || text.includes('listbox') || text.includes('option element')) {
    return 'Widget ARIA incompleto';
  }
  if (text.includes('content behind dialog') || text.includes('contenido detras') || text.includes('overlay visible')) {
    return 'Contenido de fondo accesible detrás del diálogo';
  }
  if (text.includes('dialog') && text.includes('accessible name')) {
    return 'Diálogo sin nombre accesible';
  }
  if (text.includes('scrollable') || text.includes('keyboard access') || text.includes('teclado')) {
    return 'Región desplazable no accesible por teclado';
  }
  if (text.includes('iframe') && text.includes('title')) {
    return 'Iframe sin título descriptivo';
  }
  if (text.includes('no link text') || text.includes('link has no text') || text.includes('enlace no tiene texto')) {
    return 'Enlace sin texto accesible';
  }
  if (text.includes('missing href') || text.includes('no tiene atributo href')) {
    return 'Enlace sin destino href';
  }
  if (text.includes('lang') && text.includes('html')) {
    return 'Idioma de página no definido';
  }
  if (text.includes('no nav landmark')) {
    return 'Navegación principal sin landmark';
  }
  if (text.includes('no main landmark')) {
    return 'Contenido principal sin landmark';
  }
  if (text.includes('bypass') || text.includes('skip to main')) {
    return 'Falta enlace para saltar bloques repetidos';
  }
  if (text.includes('empty list item')) {
    return 'Elemento de lista vacío';
  }
  if (text.includes('unknown table purpose')) {
    return 'Propósito de tabla no identificado';
  }
  if (text.includes('image') || text.includes('img') || text.includes('non-text') || text.includes('no textual')) {
    return 'Contenido no textual requiere revisión';
  }

  return finding?.nameEs || fallback || rawMessage || 'Hallazgo por revisar';
};

const getFindingMessageGroups = (rows: any[] = []) => {
  const groupMap = new Map<string, any>();

  for (const row of rows || []) {
    const findings = Array.isArray(row?.findings) ? row.findings : [];

    for (const finding of findings) {
      const message = getPrimaryFindingMessage(finding, row?.nombre);
      const title = getFriendlyFindingTitle(finding, row?.nombre);
      const statusType = getFindingGroupType(finding);
      const wcagRef = String(finding?.wcagCriterion || finding?.criterion || row?.id || '').trim();
      const ruleId = String(finding?.ruleId || '').trim();
      const key = [
        statusType,
        normalizeText(message),
        normalizeText(wcagRef),
        normalizeText(ruleId),
      ].join('|');

      const current = groupMap.get(key) || {
        key,
        message,
        title,
        statusType,
        findings: [],
        rows: new Map<string, any>(),
        wcagRefs: new Set<string>(),
        rules: new Set<string>(),
        views: new Set<string>(),
        roles: new Set<string>(),
        suggestions: new Set<string>(),
        descriptions: new Set<string>(),
        affectedElements: 0,
        highestSeverity: finding?.severity || 'medio',
      };

      current.findings.push(finding);
      current.title = title;
      current.rows.set(row?.id || row?.nombre || current.key, row);
      if (wcagRef) current.wcagRefs.add(wcagRef);
      if (ruleId) current.rules.add(ruleId);
      const view = getPageStateLabel(finding);
      if (view) current.views.add(view);
      if (finding?.role) current.roles.add(finding.role);
      if (finding?.suggestedFix) current.suggestions.add(finding.suggestedFix);
      for (const part of splitReportText(finding?.description || finding?.nameEs)) {
        current.descriptions.add(part);
      }
      current.affectedElements += getAffectedElementsCount(finding);
      if (getSeverityRank(finding?.severity) > getSeverityRank(current.highestSeverity)) {
        current.highestSeverity = finding?.severity || current.highestSeverity;
      }

      groupMap.set(key, current);
    }
  }

  return Array.from(groupMap.values())
    .map((group) => ({
      ...group,
      count: group.findings.length,
      criteriaCount: group.rows.size,
      wcagRefs: Array.from(group.wcagRefs),
      rules: Array.from(group.rules),
      views: Array.from(group.views),
      roles: Array.from(group.roles),
      suggestions: Array.from(group.suggestions),
      descriptions: Array.from(group.descriptions),
    }))
    .sort((a, b) => {
      const typeRank: Record<string, number> = { error: 3, revision: 2, validado: 1 };
      const rankDiff = (typeRank[b.statusType] || 0) - (typeRank[a.statusType] || 0);
      if (rankDiff !== 0) return rankDiff;
      const severityDiff = getSeverityRank(b.highestSeverity) - getSeverityRank(a.highestSeverity);
      if (severityDiff !== 0) return severityDiff;
      return b.affectedElements - a.affectedElements;
    });
};

const getFindingMessageGroupLabel = (statusType: string, count: number) => {
  if (statusType === 'error') return `${count} error${count === 1 ? '' : 'es'}`;
  if (statusType === 'validado') return `${count} buena${count === 1 ? ' práctica' : 's prácticas'}`;
  return `${count} revisión${count === 1 ? '' : 'es'}`;
};

const getFindingMessageStatusLabel = (statusType: string) => {
  if (statusType === 'error') return 'Confirmado';
  if (statusType === 'validado') return 'Validado';
  return 'Requiere revisión';
};

const getFindingSourceLabel = (finding: any) => {
  const ruleId = String(finding?.ruleId || '').toLowerCase();
  if (ruleId.startsWith('htmlcs') || ruleId.includes('wcag2')) return 'HTML_CodeSniffer';
  if (ruleId.startsWith('pa11y')) return 'Pa11y';
  if (ruleId.startsWith('peru') || ruleId.includes('29973') || ruleId.includes('pcm')) return 'Regla peruana';
  if (ruleId.startsWith('manual')) return 'Revisión manual';
  if (ruleId) return 'Axe / motor automático';
  return 'Motor automático';
};

const getFindingImpact = (finding: any) => {
  const values = Array.isArray(finding?.disability) ? finding.disability.filter(Boolean) : [];
  return values.length > 0 ? values.join(', ') : 'Impacto por revisar';
};

interface ScanReportViewProps {
  currentScan: any;
  currentProject: any;
  selectedUrlResult: any;
  onBack: () => void;
  onUrlResultSelect: (result: any) => void;
  onExport: (kind: 'pdf-executive' | 'pdf-technical' | 'excel') => void;
  canUsePaidFeatures: boolean;
  renderScoreMeter: (score: number | null | undefined, label?: string, size?: 'compact' | 'large', showCaption?: boolean) => React.ReactNode;
  getVpCategory: (vp: number | null) => { label: string; color: string };
  applicabilityRows: any[];
  filteredApplicabilityRows: any[];
  groupedApplicabilityRows: any[];
  applicabilitySummary: any;
  criterionViewMode: string;
  onCriterionViewModeChange: (mode: 'normal' | 'principles') => void;
  criterionLevelFilter: string;
  onCriterionLevelFilterChange: (value: string) => void;
  criterionApplicabilityFilter: string;
  onCriterionApplicabilityFilterChange: (value: string) => void;
  criterionResultFilter: string;
  onCriterionResultFilterChange: (value: string) => void;
  criterionSeverityFilter: string;
  onCriterionSeverityFilterChange: (value: string) => void;
  criterionRoleFilter: string;
  onCriterionRoleFilterChange: (value: string) => void;
  onApplicabilityUpdate: (criterionId: string, estado: 'aplica' | 'no_aplica') => void;
  updatingCriterionId: string | null;
  updatingFindingKey: string | null;
  expandedCriterionId: string | null;
  onToggleExpandedCriterion: (id: string | null) => void;
  onFindingStatusUpdate: (finding: any, status: 'confirmed' | 'needs_review' | 'not_applicable') => void;
  checklist86: string[];
  getApplicabilityStatusLabel: (status: string) => string;
  getApplicabilityStatusClass: (status: string) => string;
  getFindingStatusLabel: (finding: any) => string;
  getFindingStatusClass: (finding: any) => string;
  onViewPlans?: () => void;
}

export function ScanReportView({
  currentScan,
  currentProject,
  selectedUrlResult,
  onBack,
  onUrlResultSelect,
  onExport,
  canUsePaidFeatures,
  renderScoreMeter,
  getVpCategory,
  applicabilityRows,
  filteredApplicabilityRows,
  groupedApplicabilityRows,
  applicabilitySummary,
  criterionViewMode,
  onCriterionViewModeChange,
  criterionLevelFilter,
  onCriterionLevelFilterChange,
  criterionApplicabilityFilter,
  onCriterionApplicabilityFilterChange,
  criterionResultFilter,
  onCriterionResultFilterChange,
  criterionSeverityFilter,
  onCriterionSeverityFilterChange,
  criterionRoleFilter,
  onCriterionRoleFilterChange,
  onApplicabilityUpdate,
  updatingCriterionId,
  updatingFindingKey,
  expandedCriterionId,
  onToggleExpandedCriterion,
  onFindingStatusUpdate,
  checklist86,
  getApplicabilityStatusLabel,
  getApplicabilityStatusClass,
  getFindingStatusLabel,
  getFindingStatusClass,
  onViewPlans,
}: ScanReportViewProps) {
  const wcagLevelDashboard = getWcagLevelDashboard(applicabilityRows);
  const findingMessageGroups = getFindingMessageGroups(applicabilityRows);
  const findingMessageTotals = findingMessageGroups.reduce(
    (totals, group) => {
      totals.groups += 1;
      totals.elements += group.affectedElements;
      if (group.statusType === 'error') totals.errors += group.count;
      if (group.statusType === 'revision') totals.reviews += group.count;
      if (group.statusType === 'validado') totals.validated += group.count;
      return totals;
    },
    { groups: 0, elements: 0, errors: 0, reviews: 0, validated: 0 }
  );

  const scrollToReportSection = (event: React.MouseEvent<HTMLAnchorElement>, anchor: string) => {
    event.preventDefault();
    const target = document.getElementById(anchor);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${anchor}`);
  };

  return (
    <div className="report-shell page-entrance">
      <aside className="report-sidebar">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">Navegación Informe</div>
        {[
          { anchor: 'score', label: 'Score General', Icon: Gauge },
          { anchor: 'paginas', label: 'Página auditada', Icon: FileText },
          { anchor: 'estructura', label: 'Estructura semántica', Icon: ListTree },
          { anchor: 'criterios', label: 'Criterios y Hallazgos', Icon: TableProperties },
        ].map(({ anchor, label, Icon }) => (
          <a key={anchor} href={`#${anchor}`} className="report-side-link" onClick={(event) => scrollToReportSection(event, anchor)}>
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </a>
        ))}
      </aside>

      <div className="report-main-content report-section-stack">
        <section className="report-header-panel report-technical-header">
          <div className="report-technical-header-top">
            <div className="report-technical-title-row">
              <button onClick={onBack} className="report-ghost-btn report-back-btn" aria-label="Volver al proyecto">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="report-technical-title-copy">
                <p className="report-kicker">Informe técnico</p>
                <h2 className="report-title">Informe técnico: {currentProject?.name}</h2>
                <p className="report-subtitle">Auditoría realizada: {new Date(currentScan.createdAt).toLocaleString()}</p>
              </div>
            </div>
            {canUsePaidFeatures ? (
              <div className="report-export-actions">
                <button onClick={() => onExport('pdf-executive')} className="report-action-btn"><Download className="h-4 w-4" />PDF Ejecutivo</button>
                <button onClick={() => onExport('pdf-technical')} className="report-action-btn"><Download className="h-4 w-4" />PDF técnico</button>
                <button onClick={() => onExport('excel')} className="report-action-btn report-action-btn-green"><Download className="h-4 w-4" />Exportar Excel</button>
              </div>
            ) : (
              <div className="report-pro-lockout flex items-center justify-between gap-4">
                <span>Exportes y remediaciones están disponibles en Pro.</span>
                {onViewPlans && (
                  <button type="button" onClick={onViewPlans} className="report-action-btn report-action-btn-green shrink-0">
                    Ver opciones de pago
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="report-peru-badge">Resolución N.° 001-2025-PCM/SGTD · Estándar oficial Perú</div>
        </section>

        <section id="score" className="report-score-overview grid grid-cols-1 xl:grid-cols-5">
          <div className="xl:col-span-2 report-panel">
            <p className="report-kicker">Cumplimiento Global</p>
            {renderScoreMeter(currentScan.globalScore, 'Score técnico', 'large')}
          </div>

          <div className="xl:col-span-3 report-score-detail-grid grid md:grid-cols-2">
            <div className="report-panel report-panel-spacious">
              <p className="report-kicker">Fórmula de Priorización Peruana</p>
              <p className="text-slate-700 font-semibold mt-1">(p = Vo({currentProject?.vo || 4}) + Ux({currentScan.ux})) / 16</p>
              <p className="text-4xl font-black text-gob-blue mt-2">{currentScan.vp ?? 0}</p>
              <span className={`${getVpCategory(currentScan.vp).color} mt-2`}>{getVpCategory(currentScan.vp).label}</span>
            </div>
            <div className="report-panel report-panel-spacious">
              <p className="report-kicker">Criterios de Verificación</p>
              <div className="grid md:grid-cols-3 gap-3 mt-3">
                <div><p className="text-xs text-slate-500">Total de criterios</p><p className="text-xl font-bold text-slate-900">{applicabilitySummary?.totalCriteria ?? 86}</p></div>
                <div><p className="text-xs text-slate-500">Aplican al sitio</p><p className="text-xl font-bold text-slate-900">{applicabilitySummary?.applicableCount ?? '-'}</p></div>
                <div><p className="text-xs text-slate-500">Página auditada</p><p className="text-xl font-bold text-slate-900">{currentScan.urlResults?.length || 0}</p></div>
              </div>
                    <details className="mt-4 report-checklist">
                      <summary>Ver checklist de 86 criterios</summary>
                <div className="report-checklist-grid">
                  {(applicabilityRows.length > 0 ? applicabilityRows.map((row) => `${row.id} - ${row.nombre}`) : checklist86).map((item) => (
                    <span key={item} className="report-check-item">{item}</span>
                  ))}
                </div>
              </details>
            </div>
          </div>
        </section>

        <section className="report-panel report-panel-spacious wcag-level-dashboard" aria-labelledby="wcag-level-dashboard-title">
          <div className="wcag-level-dashboard-header">
            <div>
              <p className="report-kicker">Cumplimiento por nivel</p>
              <h3 id="wcag-level-dashboard-title" className="report-section-title">Resultado WCAG A, AA y AAA</h3>
              <p>Porcentaje calculado sobre los criterios aplicables de cada nivel.</p>
            </div>
            <span>{applicabilitySummary?.applicableCount ?? 0} criterios aplicables</span>
          </div>
          <div className="wcag-level-grid">
            {wcagLevelDashboard.map((item) => (
              <article key={item.level} className="wcag-level-card">
                <div className="wcag-level-card-head">
                  <span>Nivel {item.level}</span>
                  <strong>{item.percent === null ? 'N/A' : `${item.percent}%`}</strong>
                </div>
                <div
                  className="wcag-level-meter"
                  role="meter"
                  aria-label={`Cumplimiento WCAG nivel ${item.level}: ${item.percent === null ? 'no aplica' : `${item.percent} por ciento`}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={item.percent ?? 0}
                >
                  <div style={{ width: `${item.percent ?? 0}%` }} />
                </div>
                <div className="wcag-level-stats">
                  <span><strong>{item.passed}</strong> cumplen</span>
                  <span><strong>{item.failed}</strong> fallan</span>
                  <span><strong>{item.review}</strong> revisión</span>
                </div>
                <p>{item.applicable} aplican de {item.total} criterios del nivel.</p>
              </article>
            ))}
          </div>
        </section>

        <section className="report-panel report-panel-spacious finding-message-dashboard" aria-labelledby="finding-message-dashboard-title">
          <div className="finding-message-dashboard-header">
            <div>
              <p className="report-kicker">Resumen técnico</p>
              <h3 id="finding-message-dashboard-title" className="report-section-title">Resultados agrupados por problema</h3>
              <p>Abre cada problema para ver elementos afectados, evidencia, criterio WCAG y solución sugerida. La matriz legal completa se mantiene debajo.</p>
            </div>
            <div className="finding-message-totals">
              <span><strong>{findingMessageTotals.errors}</strong> errores</span>
              <span><strong>{findingMessageTotals.reviews}</strong> revisiones</span>
              <span><strong>{findingMessageTotals.elements}</strong> elementos</span>
            </div>
          </div>
          {!canUsePaidFeatures ? (
            <div className="report-pro-lockout-large relative p-8 text-center bg-slate-50 border border-slate-200 rounded-lg mt-6">
              <Lock className="mx-auto h-8 w-8 text-slate-400 mb-3" />
              <h4 className="text-lg font-medium text-slate-900 mb-2">Agrupación inteligente disponible en Pro</h4>
              <p className="text-slate-600 mb-4 max-w-md mx-auto">
                La agrupación de problemas, el análisis de impacto técnico y la inspección de código afectado son funciones exclusivas de cuentas Pro.
              </p>
              {onViewPlans && (
                <button type="button" onClick={onViewPlans} className="report-action-btn report-action-btn-green mx-auto">
                  Ver opciones de pago
                </button>
              )}
            </div>
          ) : findingMessageGroups.length === 0 ? (
            <div className="finding-message-empty">
              No hay hallazgos activos para agrupar. Revisa la matriz WCAG para validar criterios cumplidos y no aplicables.
            </div>
          ) : (
            <div className="finding-message-list">
              {findingMessageGroups.map((group) => {
                const sampleFindings = group.findings.slice(0, 4);
                const wcagText = group.wcagRefs.length > 0 ? group.wcagRefs.join(', ') : 'WCAG por validar';
                const ruleText = group.rules.length > 0 ? group.rules.slice(0, 2).join(', ') : 'Regla automática';
                const description = getFindingDisplayDescription(group.findings[0], group.descriptions[0] || group.message);
                const suggestion = group.suggestions[0] || 'Revisar el contexto del componente y aplicar la corrección WCAG correspondiente.';

                return (
                  <details
                    key={group.key}
                    className={`finding-message-group finding-message-group-${group.statusType}`}
                  >
                    <summary>
                      <span className={`finding-message-count finding-message-count-${group.statusType}`}>
                        {getFindingMessageGroupLabel(group.statusType, group.count)}
                      </span>
                      <span className="finding-message-summary-copy">
                        <strong>{group.title}</strong>
                        <small>
                          {getFindingMessageStatusLabel(group.statusType)} · {group.affectedElements} elemento{group.affectedElements === 1 ? '' : 's'} afectado{group.affectedElements === 1 ? '' : 's'} · Criterio {wcagText}
                        </small>
                      </span>
                      <span className={`finding-message-severity ${getSeverityClass(group.highestSeverity)}`}>{group.highestSeverity || 'medio'}</span>
                    </summary>

                    <div className="finding-message-body">
                      <div className="finding-message-body-grid">
                        <div>
                          <span>Qué significa</span>
                          <p>{description}</p>
                        </div>
                        <div>
                          <span>Criterio WCAG</span>
                          <p>{wcagText}</p>
                        </div>
                        <div>
                          <span>Regla / motor</span>
                          <p>{ruleText}</p>
                        </div>
                        <div>
                          <span>Vistas evaluadas</span>
                          <p>{group.views.length > 0 ? group.views.join(', ') : 'Vista principal'}</p>
                        </div>
                        <div>
                          <span>Rol responsable</span>
                          <p>{group.roles.length > 0 ? group.roles.join(', ') : 'Por asignar'}</p>
                        </div>
                        <div>
                          <span>Solución sugerida</span>
                          <p>{canUsePaidFeatures ? suggestion : 'Disponible en Pro'}</p>
                        </div>
                        <div className="finding-message-technical">
                          <span>Mensaje técnico</span>
                          <p>{group.message}</p>
                        </div>
                      </div>

                      <div className="finding-message-samples">
                        <div className="finding-message-samples-head">
                          <span>Elementos de muestra</span>
                          <strong>{group.affectedElements} afectados en {group.criteriaCount} criterio{group.criteriaCount === 1 ? '' : 's'}</strong>
                        </div>
                        {sampleFindings.map((finding: any, findingIndex: number) => {
                          const selectors = Array.isArray(finding?.affectedElements) ? finding.affectedElements.filter(Boolean) : [];
                          const samples = Array.isArray(finding?.affectedHtmlSamples) ? finding.affectedHtmlSamples.filter(Boolean) : [];
                          const sample = selectors[0] || samples[0] || finding?.selector || finding?.elementHtml || 'Sin selector o HTML disponible';

                          return (
                            <div key={`${group.key}-${findingIndex}`} className="finding-message-sample-row">
                              <span>{findingIndex + 1}</span>
                              <code>{sample}</code>
                            </div>
                          );
                        })}
                        {group.findings.length > sampleFindings.length && (
                          <p className="finding-message-more">+{group.findings.length - sampleFindings.length} grupos adicionales con el mismo problema.</p>
                        )}
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>

        <section id="paginas" className="report-panel report-panel-spacious">
          <div className="flex items-center justify-between mb-3">
            <h3 className="report-section-title">Página auditada</h3>
          </div>
          <div className="report-audited-page-grid grid gap-3">
            {currentScan.urlResults?.length === 0 ? (
              <div className="col-span-full text-center py-8 text-slate-400 text-sm">No hay páginas auditadas</div>
            ) : currentScan.urlResults?.map((ur: any) => (
              <button key={ur.id} onClick={() => onUrlResultSelect(ur)} className={`report-url-card ${selectedUrlResult?.id === ur.id ? 'report-url-card-active' : ''}`}>
                <p className="font-mono text-xs text-slate-500 truncate text-left">{ur.url}</p>
                <div className="mt-3 flex text-xs">
                  <span className="report-chip">Score {ur.score}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {selectedUrlResult && (
          <>
            <section id="criterios" className="report-panel report-panel-spacious">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="report-section-title">Criterios WCAG y Hallazgos</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {applicabilitySummary
                      ? `Aplican ${applicabilitySummary.applicableCount} de ${applicabilitySummary.totalCriteria} criterios a este sitio. Cumple ${applicabilitySummary.passedCount}. Requiere revisión ${applicabilitySummary.reviewCount ?? 0}.`
                      : 'Sin matriz de aplicabilidad para este resultado.'}
                  </p>
                </div>
                <label className="report-view-mode-control">
                  <span>Vista</span>
                  <select
                    autoComplete="off"
                    className="report-table-filter"
                    value={criterionViewMode}
                    onChange={e => onCriterionViewModeChange(e.target.value as 'normal' | 'principles')}
                  >
                    <option value="normal">Orden normal</option>
                    <option value="principles">Por principios</option>
                  </select>
                </label>
              </div>

              <div className="report-applicability-summary-row">
                <div className="report-applicability-card">
                  <span>Total</span>
                  <strong>{applicabilitySummary?.totalCriteria ?? 86}</strong>
                </div>
                <div className="report-applicability-card">
                  <span>Aplican</span>
                  <strong>{applicabilitySummary?.applicableCount ?? 0}</strong>
                </div>
                <div className="report-applicability-card">
                  <span>Cumplen</span>
                  <strong>{applicabilitySummary?.passedCount ?? 0}</strong>
                </div>
                <div className="report-applicability-card">
                  <span>Fallan</span>
                  <strong>{applicabilitySummary?.failedCount ?? 0}</strong>
                </div>
                <div className="report-applicability-card">
                  <span>Revisión</span>
                  <strong>{applicabilitySummary?.reviewCount ?? 0}</strong>
                </div>
                <div className="report-applicability-card">
                  <span>No aplican</span>
                  <strong>{applicabilitySummary?.notApplicableCount ?? 0}</strong>
                </div>
              </div>

              <div className="report-filter-stack">
                <label>
                  <span>Nivel WCAG</span>
                  <select aria-label="Filtrar por nivel WCAG" autoComplete="off" className="report-table-filter" value={criterionLevelFilter} onChange={e => onCriterionLevelFilterChange(e.target.value)}>
                    <option value="todos">Todos</option>
                    <option value="A">A</option>
                    <option value="AA">AA</option>
                    <option value="AAA">AAA</option>
                  </select>
                </label>
                <label>
                  <span>Aplicabilidad</span>
                  {canUsePaidFeatures ? (
                    <select aria-label="Filtrar por aplicabilidad" autoComplete="off" className="report-table-filter" value={criterionApplicabilityFilter} onChange={e => onCriterionApplicabilityFilterChange(e.target.value)}>
                      <option value="todos">Todos</option>
                      <option value="aplica">Aplica</option>
                      <option value="no_aplica">No aplica</option>
                    </select>
                  ) : (
                    <button type="button" onClick={onViewPlans} className="report-pro-locked-pill cursor-pointer hover:bg-slate-200">Plan Pro</button>
                  )}
                </label>
                <label>
                  <span>Resultado</span>
                  {canUsePaidFeatures ? (
                    <select aria-label="Filtrar por resultado" autoComplete="off" className="report-table-filter" value={criterionResultFilter} onChange={e => onCriterionResultFilterChange(e.target.value)}>
                      <option value="todos">Todos</option>
                      <option value="cumple">Cumple</option>
                      <option value="falla">Falla</option>
                      <option value="revision">Requiere revisión</option>
                      <option value="na">N/A</option>
                    </select>
                  ) : (
                    <button type="button" onClick={onViewPlans} className="report-pro-locked-pill cursor-pointer hover:bg-slate-200">Plan Pro</button>
                  )}
                </label>
                <label>
                  <span>Severidad</span>
                  <select aria-label="Filtrar por severidad" autoComplete="off" className="report-table-filter" value={criterionSeverityFilter} onChange={e => onCriterionSeverityFilterChange(e.target.value)}>
                    <option value="todos">Todas</option>
                    <option value="critico">Crítico</option>
                    <option value="alto">Alto</option>
                    <option value="medio">Medio</option>
                    <option value="bajo">Bajo</option>
                  </select>
                </label>
                <label>
                  <span>Rol</span>
                  <select aria-label="Filtrar por rol" autoComplete="off" className="report-table-filter" value={criterionRoleFilter} onChange={e => onCriterionRoleFilterChange(e.target.value)}>
                    <option value="todos">Todos</option>
                    <option value="Desarrollador">Desarrollador</option>
                    <option value="Diseñador UX/UI">Diseñador UX/UI</option>
                    <option value="Redactor UX">Redactor UX</option>
                    <option value="Compartido">Compartido</option>
                  </select>
                </label>
              </div>

              <div className="report-table-scroll overflow-x-auto">
                <table className="w-full report-table report-table-spacious" aria-label="Tabla unificada de criterios WCAG y hallazgos">
                  <thead>
                    <tr>
                      <th scope="col">Criterio</th>
                      <th scope="col">
                        <div className="report-table-header-cell">
                          <span className="report-table-filter-label">Nivel WCAG</span>
                          <select aria-label="Filtrar por nivel WCAG" autoComplete="off" className="report-table-filter" value={criterionLevelFilter} onChange={e => onCriterionLevelFilterChange(e.target.value)}>
                            <option value="todos">Todos</option>
                            <option value="A">A</option>
                            <option value="AA">AA</option>
                            <option value="AAA">AAA</option>
                          </select>
                        </div>
                      </th>
                      <th scope="col">
                        <div className="report-table-header-cell">
                          <span className="report-table-filter-label">Aplicabilidad</span>
                          {canUsePaidFeatures ? (
                            <select aria-label="Filtrar por aplicabilidad" autoComplete="off" className="report-table-filter" value={criterionApplicabilityFilter} onChange={e => onCriterionApplicabilityFilterChange(e.target.value)}>
                              <option value="todos">Todos</option>
                              <option value="aplica">Aplica</option>
                              <option value="no_aplica">No aplica</option>
                            </select>
                          ) : (
                            <span className="report-pro-locked-pill">Plan Pro</span>
                          )}
                        </div>
                      </th>
                      <th scope="col">
                        <div className="report-table-header-cell">
                          <span className="report-table-filter-label">Resultado</span>
                          {canUsePaidFeatures ? (
                            <select aria-label="Filtrar por resultado" autoComplete="off" className="report-table-filter" value={criterionResultFilter} onChange={e => onCriterionResultFilterChange(e.target.value)}>
                              <option value="todos">Todos</option>
                              <option value="cumple">Cumple</option>
                              <option value="falla">Falla</option>
                              <option value="revision">Requiere revisión</option>
                              <option value="na">N/A</option>
                            </select>
                          ) : (
                            <span className="report-pro-locked-pill">Plan Pro</span>
                          )}
                        </div>
                      </th>
                      <th scope="col">Nombre</th>
                      <th scope="col">Motivo de Aplicabilidad</th>
                      <th scope="col">Hallazgos</th>
                      <th scope="col">
                        <div className="report-table-header-cell">
                          <span className="report-table-filter-label">Severidad</span>
                          <select aria-label="Filtrar por severidad" autoComplete="off" className="report-table-filter" value={criterionSeverityFilter} onChange={e => onCriterionSeverityFilterChange(e.target.value)}>
                            <option value="todos">Todas</option>
                            <option value="critico">Crítico</option>
                            <option value="alto">Alto</option>
                            <option value="medio">Medio</option>
                            <option value="bajo">Bajo</option>
                          </select>
                        </div>
                      </th>
                      <th scope="col">Estado hallazgo</th>
                      <th scope="col">Descripción</th>
                      <th scope="col">
                        <div className="report-table-header-cell">
                          <span className="report-table-filter-label">Rol</span>
                          <select aria-label="Filtrar por rol" autoComplete="off" className="report-table-filter" value={criterionRoleFilter} onChange={e => onCriterionRoleFilterChange(e.target.value)}>
                            <option value="todos">Todos</option>
                            <option value="Desarrollador">Desarrollador</option>
                            <option value="Diseñador UX/UI">Diseñador UX/UI</option>
                            <option value="Redactor UX">Redactor UX</option>
                            <option value="Compartido">Compartido</option>
                          </select>
                        </div>
                      </th>
                      <th scope="col">Solución sugerida</th>
                      <th scope="col">Evidencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApplicabilityRows.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="text-center text-slate-500">No hay criterios para el filtro seleccionado.</td>
                      </tr>
                    ) : groupedApplicabilityRows.map((item) => {
                      if (item.kind === 'principle') {
                        return (
                          <tr key={`principle-${item.key}`} className="report-principle-row">
                            <td colSpan={13}>
                              <div className="report-principle-row-content">
                                <strong>{item.key === 'otros' ? item.title : `${item.key}. ${item.title}`}</strong>
                                <span>{item.description}</span>
                                <em>{item.count} criterio(s)</em>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      if (item.kind === 'guideline') {
                        return (
                          <tr key={`guideline-${item.key}`} className="report-guideline-row">
                            <td colSpan={13}>
                              <div className="report-guideline-row-content">
                                <strong>{item.key === 'otros' ? item.title : `Pauta ${item.key}. ${item.title}`}</strong>
                                <span>{item.description}</span>
                                <em>{item.count} criterio(s)</em>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      const row = item.row;
                      const finding = getHighestSeverityFinding(row.findings) || row.primaryFinding;
                      const findingCount = row.findings?.length || 0;
                      const affectedFindingCount = row.affectedFindingCount || findingCount;
                      const statusSummaryItems = getFindingStatusSummaryItems(row.findings);
                      const roleSummary = getUniqueValues(row.findings, (findingItem) => findingItem.role);
                      const descriptionSummary = getFindingDescriptionSummary(row.findings, row.manualVerifications);
                      const hasMultipleFindings = findingCount > 1;
                      return (
                        <React.Fragment key={item.key}>
                          <tr className="report-row-hover">
                            <td>{row.id}</td>
                            <td>{row.nivel}</td>
                            <td>
                              {canUsePaidFeatures ? (
                                <select
                                  aria-label={`Editar aplicabilidad del criterio ${row.id}`}
                                  autoComplete="off"
                                  className="report-table-filter report-applicability-edit"
                                  value={row.estado}
                                  disabled={updatingCriterionId === row.id}
                                  onChange={e => onApplicabilityUpdate(row.id, e.target.value as 'aplica' | 'no_aplica')}
                                >
                                  <option value="aplica">Aplica</option>
                                  <option value="no_aplica">No aplica</option>
                                </select>
                              ) : (
                                <span className="report-pro-locked-pill">Disponible en Pro</span>
                              )}
                            </td>
                            <td>
                              {canUsePaidFeatures
                                ? (row.estado === 'no_aplica' ? '' : <span className={`report-status-badge ${getApplicabilityStatusClass(row.uiStatus)}`}>{getApplicabilityStatusLabel(row.uiStatus)}</span>)
                                : <span className="report-pro-locked-pill">Disponible en Pro</span>}
                            </td>
                            <td>{row.nombre}</td>
                            <td>{canUsePaidFeatures ? row.razon : <span className="report-pro-locked-pill">Disponible en Pro</span>}</td>
                            <td>
                              {!canUsePaidFeatures ? (
                                <span className="report-pro-locked-pill">Disponible en Pro</span>
                              ) : row.estado === 'aplica' && findingCount > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => onToggleExpandedCriterion(expandedCriterionId === row.id ? null : row.id)}
                                  className="report-finding-count-btn"
                                >
                                  {getFindingCountLabel(findingCount, affectedFindingCount)}
                                </button>
                              ) : ''}
                            </td>
                            <td>{canUsePaidFeatures ? (finding ? <span className={`report-severity-chip ${getSeverityClass(finding.severity)}`}>{finding.severity}</span> : '') : <span className="report-pro-locked-pill">Disponible en Pro</span>}</td>
                            <td>{canUsePaidFeatures ? (finding ? (
                              <div className="report-inline-stack">
                                {hasMultipleFindings ? (
                                  statusSummaryItems.map((status) => (
                                    <span key={status.key} className={`report-status-badge ${status.className}`}>{status.label}</span>
                                  ))
                                ) : (
                                  <span className={`report-status-badge ${getFindingStatusClass(finding)}`}>{getFindingStatusLabel(finding)}</span>
                                )}
                              </div>
                            ) : '') : <span className="report-pro-locked-pill">Disponible en Pro</span>}</td>
                            <td>{canUsePaidFeatures ? descriptionSummary : <span className="report-pro-locked-pill">Disponible en Pro</span>}</td>
                            <td>{canUsePaidFeatures ? (roleSummary.length > 0 ? roleSummary.join(', ') : finding?.role || '') : <span className="report-pro-locked-pill">Disponible en Pro</span>}</td>
                            <td>{canUsePaidFeatures ? (finding?.suggestedFix || '') : <span className="report-pro-locked-pill">Disponible en Pro</span>}</td>
                            <td>
                              {canUsePaidFeatures && findingCount > 0 ? (
                                <button onClick={() => onToggleExpandedCriterion(expandedCriterionId === row.id ? null : row.id)} className="report-evidence-btn">
                                  {expandedCriterionId === row.id ? 'Ocultar' : 'Ver detalle'}
                                </button>
                              ) : !canUsePaidFeatures ? (
                                <span className="report-pro-locked-pill">Disponible en Pro</span>
                              ) : ''}
                            </td>
                          </tr>
                          {canUsePaidFeatures && expandedCriterionId === row.id && findingCount > 0 && (
                            <tr>
                              <td colSpan={13} className="report-evidence-cell">
                                <div className="report-finding-detail-list">
                                  <div className="report-finding-group-summary">
                                    <strong>{getFindingCountLabel(findingCount, affectedFindingCount)}</strong>
                                    <span>Los grupos unen problemas iguales por regla, vista y criterio. Los elementos afectados aparecen dentro de cada grupo.</span>
                                  </div>
                                  {row.findings.map((item: any, itemIndex: number) => {
                                    const affectedSelectors = Array.isArray(item.affectedElements) ? item.affectedElements.filter(Boolean) : [];
                                    const affectedSamples = Array.isArray(item.affectedHtmlSamples) ? item.affectedHtmlSamples.filter(Boolean) : [];
                                    const occurrenceItems = affectedSelectors.length > 0 ? affectedSelectors : affectedSamples;
                                    const occurrenceCount = getAffectedElementsCount(item);
                                    const groupType = getFindingGroupType(item);
                                    return (
                                      <details key={`${row.id}-${itemIndex}`} className={`report-finding-group report-finding-group-${groupType}`} open={itemIndex === 0}>
                                        <summary>
                                          <span className={`report-finding-group-count report-finding-group-count-${groupType}`}>
                                            {getFindingGroupBadge(item, occurrenceCount)}
                                          </span>
                                          <span className="report-finding-group-title">
                                            <strong>{getFindingDescriptionSummary([item]) || item.nameEs || row.nombre}</strong>
                                            <small>{item.ruleId || item.wcagCriterion || item.criterion || row.id}</small>
                                          </span>
                                          <span className={`report-severity-chip ${getSeverityClass(item.severity)}`}>{item.severity || 'medio'}</span>
                                        </summary>

                                        <article className="report-finding-detail-card">
                                          <div className="report-finding-detail-header">
                                            <div>
                                              <p className="report-finding-detail-kicker">Grupo {itemIndex + 1} de {findingCount}</p>
                                              <h4>{item.nameEs || row.nombre}</h4>
                                            </div>
                                            <div className="report-finding-detail-badges">
                                              <span className={`report-status-badge ${getFindingStatusClass(item)}`}>{getFindingStatusLabel(item)}</span>
                                              <span className="report-elements-badge">{occurrenceCount} elemento{occurrenceCount === 1 ? '' : 's'} afectado{occurrenceCount === 1 ? '' : 's'}</span>
                                            </div>
                                          </div>

                                          <div className="report-review-actions" aria-label={`Acciones de revisión para ${item.nameEs || row.nombre}`}>
                                            <div>
                                              <span>Decisión del auditor</span>
                                              <p>Confirma el resultado después de revisar la evidencia, el HTML y el contexto real.</p>
                                            </div>
                                            <div className="report-review-action-buttons">
                                              <button
                                                type="button"
                                                className="report-review-btn report-review-pass"
                                                disabled={updatingFindingKey === getFindingReviewKey(item)}
                                                onClick={() => onFindingStatusUpdate(item, 'not_applicable')}
                                              >
                                                Confirmar cumple
                                              </button>
                                              <button
                                                type="button"
                                                className="report-review-btn report-review-fail"
                                                disabled={updatingFindingKey === getFindingReviewKey(item)}
                                                onClick={() => onFindingStatusUpdate(item, 'confirmed')}
                                              >
                                                Confirmar falla
                                              </button>
                                              <button
                                                type="button"
                                                className="report-review-btn report-review-pending"
                                                disabled={updatingFindingKey === getFindingReviewKey(item)}
                                                onClick={() => onFindingStatusUpdate(item, 'needs_review')}
                                              >
                                                Dejar en revisión
                                              </button>
                                            </div>
                                          </div>

                                          <div className="report-finding-detail-grid">
                                            <div><span>Fuente</span><strong>{getFindingSourceLabel(item)}</strong></div>
                                            <div><span>Vista evaluada</span><strong>{getPageStateLabel(item)}</strong></div>
                                            <div><span>Rol responsable</span><strong>{item.role || 'Por asignar'}</strong></div>
                                            <div><span>Impacto</span><strong>{getFindingImpact(item)}</strong></div>
                                            <div><span>Criterio WCAG</span><strong>{item.wcagCriterion || item.criterion || row.id}</strong></div>
                                            <div><span>Regla</span><strong>{item.ruleId || 'Sin identificador'}</strong></div>
                                          </div>

                                          <div className="report-finding-detail-copy">
                                            <div><span>Descripción</span><p>{canUsePaidFeatures ? (getFindingDescriptionSummary([item]) || 'Sin descripción técnica disponible.') : 'Disponible en Pro'}</p></div>
                                            <div><span>Selector principal</span>{item.selector ? <code className="report-code">{item.selector}</code> : <p>Sin selector disponible.</p>}</div>
                                            <div><span>Solución sugerida</span><p>{canUsePaidFeatures ? (item.suggestedFix || 'Sin solución sugerida registrada.') : 'Disponible en Pro'}</p></div>
                                            {item.wcagUrl && <a href={item.wcagUrl} target="_blank" rel="noreferrer" className="report-reference-link">Ver criterio WCAG oficial</a>}
                                          </div>

                                          {occurrenceItems.length > 0 && (
                                            <div className="report-finding-occurrences">
                                              <div className="report-finding-occurrences-head">
                                                <span>Elementos dentro de este grupo</span>
                                                <strong>{occurrenceCount}</strong>
                                              </div>
                                              <div className="report-finding-occurrence-list">
                                                {occurrenceItems.slice(0, 12).map((occurrence: string, occurrenceIndex: number) => (
                                                  <div key={`${row.id}-${itemIndex}-${occurrenceIndex}`}>
                                                    <span>{occurrenceIndex + 1}</span>
                                                    <code>{occurrence}</code>
                                                  </div>
                                                ))}
                                              </div>
                                              {occurrenceItems.length > 12 && <p className="report-finding-occurrence-note">+{occurrenceItems.length - 12} elementos adicionales agrupados en este mismo problema.</p>}
                                            </div>
                                          )}

                                          <div className="report-finding-evidence-grid">
                                            <div>
                                              <p className="report-finding-detail-kicker">HTML afectado</p>
                                              <pre className="report-html-block"><code>{item.elementHtml || 'Sin fragmento HTML disponible.'}</code></pre>
                                            </div>
                                            {item.screenshotUrl ? <EvidencePreview url={item.screenshotUrl} /> : <div className="report-no-evidence">Sin evidencia visual disponible</div>}
                                          </div>
                                        </article>
                                      </details>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <SemanticStructureViewer structure={selectedUrlResult.semanticStructure} />
          </>
        )}
      </div>
    </div>
  );
}

