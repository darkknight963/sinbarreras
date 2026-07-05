import React from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Download,
  FileSearch,
  Link as LinkIcon,
  Minus,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
  Copy,
  Check,
} from 'lucide-react';

const EXTENSION_DOWNLOAD_URL = 'https://chromewebstore.google.com/detail/sin-barreras-auditoria-au/bipiiijphpkdbodephdbahlkdcnopjao';

interface ProjectDetailViewProps {
  currentProject: any;
  onBack: () => void;
  backLabel?: string;
  onNewScanClick: () => void;
  onScanClick: (scan: any) => void;
  onDeleteScan: (scan: any, event: React.MouseEvent) => void;
  onCancelScan?: (scanId: string) => Promise<void> | void;
  showNewScan: boolean;
  onCloseNewScan: () => void;
  onTriggerScan: (e: React.FormEvent) => void;
  newScanUrls: string;
  onNewScanUrlsChange: (value: string) => void;
  parsedNewScanUrls: string[];
  newScanLoginMode: 'none' | 'manual_assisted';
  onNewScanLoginModeChange: (value: 'none' | 'manual_assisted') => void;
  canUseManualLogin: boolean;
  canScanMultipleUrls: boolean;
  freeReservedUrl: string | null;
  scanProgress: Record<string, number>;
  renderScoreMeter: (score: number | null | undefined, label?: string, size?: 'compact' | 'large', showCaption?: boolean) => React.ReactNode;
  renderStatusBadge: (status: string) => React.ReactNode;
  openInspectionUrl: (url: string) => void;
  hasMoreScans?: boolean;
  loadingMoreScans?: boolean;
  onLoadMoreScans?: () => void;
}

const trendDateLabel = (value: string) =>
  new Date(value).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });

// Clave de comparación: mismas URLs (sin importar orden ni mayúsculas).
// Solo tiene sentido comparar scores entre escaneos del MISMO objetivo:
// dentro de un proyecto pueden convivir escaneos de URLs distintas.
const scanTargetKey = (scan: any) =>
  JSON.stringify(
    [...(Array.isArray(scan.scanUrls) ? scan.scanUrls : [])]
      .map((url: any) => String(url).trim().toLowerCase().replace(/\/+$/, ''))
      .sort(),
  );

// Línea de tendencia del score (serie única, 0-100). Los datos ya vienen en
// currentProject.scans — cero requests adicionales. La lista de historial
// debajo actúa como vista de tabla accesible de la misma serie.
function ScoreTrend({ scans }: { scans: any[] }) {
  const completed = [...scans]
    .filter((scan) => scan.status === 'completed' && typeof scan.globalScore === 'number')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (completed.length < 2) return null;

  // La serie sigue al objetivo del análisis más reciente: solo scans de esas
  // mismas URLs. Comparar sitios distintos produciría "caídas" falsas.
  const latest = completed[completed.length - 1];
  const targetKey = scanTargetKey(latest);
  const points = completed.filter((scan) => scanTargetKey(scan) === targetKey).slice(-12);

  if (points.length < 2) return null;

  const targetUrls: string[] = Array.isArray(latest.scanUrls) ? latest.scanUrls : [];
  const targetLabel = targetUrls.length > 0
    ? `${targetUrls[0].replace(/^https?:\/\//, '')}${targetUrls.length > 1 ? ` +${targetUrls.length - 1} más` : ''}`
    : '';

  const width = 560;
  const height = 132;
  const pad = { top: 18, right: 18, bottom: 24, left: 34 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const xFor = (index: number) => pad.left + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const yFor = (score: number) => pad.top + (1 - Math.max(0, Math.min(100, score)) / 100) * innerH;

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const delta = (last.globalScore ?? 0) - (prev.globalScore ?? 0);
  const deltaTone = delta > 0 ? '#15803d' : delta < 0 ? '#b91c1c' : '#64748b';
  const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const deltaLabel = delta === 0
    ? 'Sin cambios vs. análisis anterior'
    : `${delta > 0 ? '+' : ''}${delta} pts vs. análisis anterior`;

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.globalScore).toFixed(1)}`)
    .join(' ');

  return (
    <div className="score-trend" style={{ marginBottom: '0.5rem' }}>
      <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h4 className="font-semibold text-sm text-gob-dark" style={{ margin: 0 }}>Evolución del cumplimiento</h4>
          {targetLabel && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{targetLabel} · {points.length} análisis comparables</span>
          )}
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: deltaTone }}>
          <DeltaIcon className="h-4 w-4" aria-hidden="true" />
          {deltaLabel}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label={`Evolución del score de cumplimiento en los últimos ${points.length} análisis. Último: ${last.globalScore} de 100. ${deltaLabel}.`}
      >
        {[0, 50, 100].map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={yFor(tick)} y2={yFor(tick)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={pad.left - 8} y={yFor(tick) + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8">{tick}</text>
          </g>
        ))}
        <path d={path} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          return (
            <circle key={p.id} cx={xFor(i)} cy={yFor(p.globalScore)} r={isLast ? 5 : 4} fill="#2563eb" stroke="#ffffff" strokeWidth="2">
              <title>{`${p.globalScore}/100 · ${trendDateLabel(p.createdAt)}`}</title>
            </circle>
          );
        })}
        <text
          x={Math.min(xFor(points.length - 1), width - pad.right - 4)}
          y={Math.max(yFor(last.globalScore) - 10, 12)}
          textAnchor="end"
          fontSize="12"
          fontWeight="700"
          fill="#0f172a"
        >
          {last.globalScore}
        </text>
        <text x={pad.left} y={height - 6} fontSize="10" fill="#94a3b8">{trendDateLabel(points[0].createdAt)}</text>
        <text x={width - pad.right} y={height - 6} textAnchor="end" fontSize="10" fill="#94a3b8">{trendDateLabel(last.createdAt)}</text>
      </svg>
    </div>
  );
}


export function ProjectDetailView({
  currentProject,
  onBack,
  backLabel = 'Volver a proyectos',
  onNewScanClick,
  onScanClick,
  onDeleteScan,
  onCancelScan,
  showNewScan,
  onCloseNewScan,
  onTriggerScan,
  newScanUrls,
  onNewScanUrlsChange,
  parsedNewScanUrls,
  newScanLoginMode,
  onNewScanLoginModeChange,
  canUseManualLogin,
  canScanMultipleUrls,
  freeReservedUrl,
  scanProgress,
  renderScoreMeter,
  renderStatusBadge,
  openInspectionUrl,
  hasMoreScans = false,
  loadingMoreScans = false,
  onLoadMoreScans,
}: ProjectDetailViewProps) {
  const urlCount = parsedNewScanUrls.length;
  const scans = [...new Map((currentProject.scans || []).map((scan: any) => [scan.id, scan])).values()].sort((a: any, b: any) => {
    const bTime = new Date(b.createdAt || 0).getTime();
    const aTime = new Date(a.createdAt || 0).getTime();
    return bTime - aTime;
  });
  const hasScans = scans.length > 0;
  const newScanDialogRef = React.useRef<HTMLDivElement>(null);
  const onCloseNewScanRef = React.useRef(onCloseNewScan);
  const [cancellingScanId, setCancellingScanId] = React.useState<string | null>(null);
  const [pendingScanId, setPendingScanId] = React.useState('');
  const [copiedId, setCopiedId] = React.useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard', err);
    }
  };

  React.useEffect(() => {
    onCloseNewScanRef.current = onCloseNewScan;
  }, [onCloseNewScan]);

  React.useEffect(() => {
    if (!showNewScan) return;
    setPendingScanId(crypto.randomUUID());
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTarget = window.setTimeout(() => {
      newScanDialogRef.current?.querySelector<HTMLInputElement>('#new-scan-urls')?.focus();
    }, 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseNewScanRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTarget);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [showNewScan]);

  React.useEffect(() => {
    if (showNewScan) {
      document.body.classList.add('scan-modal-open');
      return () => document.body.classList.remove('scan-modal-open');
    }
  }, [showNewScan]);

  const canonicalizePlanUrl = (value: string) => {
    try {
      const parsed = new URL(value);
      parsed.hash = '';
      parsed.hostname = parsed.hostname.toLowerCase();
      if (
        (parsed.protocol === 'http:' && parsed.port === '80') ||
        (parsed.protocol === 'https:' && parsed.port === '443')
      ) {
        parsed.port = '';
      }
      parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
      return parsed.toString();
    } catch {
      return value.trim();
    }
  };
  const exceedsUrlLimit = urlCount > 1;
  const changesFreeUrl = !canScanMultipleUrls && Boolean(freeReservedUrl) && urlCount === 1
    && canonicalizePlanUrl(parsedNewScanUrls[0]) !== canonicalizePlanUrl(freeReservedUrl || '');
  const blocksFreeScan = exceedsUrlLimit || changesFreeUrl;
  const isManualLoginLocked = !canUseManualLogin;
  const getScanModeLabel = (scanMode: string) => {
    if (scanMode === 'rápido') return 'Análisis rápido';
    if (scanMode === 'profundo') return 'Análisis profundo';
    return 'Análisis estándar';
  };

  const getScanDisplayUrl = (scan: any) => {
    if (scan.scanUrls?.length > 0) {
      try {
        const u = new URL(scan.scanUrls[0]);
        return u.hostname + (u.pathname !== '/' ? u.pathname : '');
      } catch { return scan.scanUrls[0]; }
    }
    if (currentProject?.domain) return currentProject.domain;
    return 'Sitio web';
  };
  const urlHelpText = freeReservedUrl
    ? `Puedes reescanear tu URL guardada: ${freeReservedUrl}.`
    : 'Ingresa una URL pública para este análisis.';

  React.useEffect(() => {
    if (isManualLoginLocked && newScanLoginMode === 'manual_assisted') {
      onNewScanLoginModeChange('none');
    }
  }, [isManualLoginLocked, newScanLoginMode, onNewScanLoginModeChange]);
  const getScanProgressValue = (scan: any, progress: number | undefined) => {
    // Completed/failed/cancelled are terminal — ignore any lingering animated value.
    if (scan.status === 'completed') return 100;
    if (scan.status === 'failed' || scan.status === 'cancelled') return 0;
    const rawProgress = progress ?? scan.progress ?? scan.scanProgress ?? 0;
    const numericProgress = Number(rawProgress);
    if (!Number.isFinite(numericProgress)) return 0;
    return Math.max(0, Math.min(100, Math.round(numericProgress)));
  };

  const getScanStatusLabel = (status: string, progress: number) => {
    if (status === 'awaiting_login') return 'Login manual pendiente';
    if (status === 'completed') return 'Completado';
    if (status === 'failed') return 'Falló';
    if (status === 'cancelled') return 'Cancelado';
    // pending / running: reassuring messages that mirror the real scan stages so the
    // user trusts the analysis is moving forward (the % is animated client-side).
    if (status === 'pending' && progress < 6) return 'Preparando el análisis...';
    if (progress < 15) return 'Conectando con la página...';
    if (progress < 28) return 'Cargando contenido y recursos...';
    if (progress < 40) return 'Analizando estructura y encabezados...';
    if (progress < 52) return 'Evaluando contraste y color...';
    if (progress < 64) return 'Revisando criterios WCAG 2.2...';
    if (progress < 74) return 'Verificando teclado y navegación...';
    if (progress < 84) return 'Capturando evidencia visual...';
    if (progress < 92) return 'Aplicando normativa peruana...';
    return 'Ya casi está, generando informe...';
  };

  return (
    <>
      {showNewScan && (
        <div
          className="scan-launch-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onCloseNewScan();
          }}
        >
          <section
            ref={newScanDialogRef}
            className="scan-launch-card scan-launch-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-scan-modal-title"
            aria-describedby="new-scan-modal-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="scan-launch-header scan-launch-modal-header">
              <div>
                <p className="scan-launch-kicker">Nuevo análisis</p>
                <h2 id="new-scan-modal-title">Lanzar auditoría</h2>
                <p id="new-scan-modal-description">Ingresa la URL del sitio que quieres auditar.</p>
              </div>
              <button
                type="button"
                className="scan-launch-modal-close"
                onClick={onCloseNewScan}
                aria-label="Cerrar nuevo análisis"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={onTriggerScan} className="scan-launch-form">
              <input type="hidden" name="scanId" value={pendingScanId} />
              <div className="scan-launch-field scan-launch-url-field">
                <div className="scan-launch-label-row">
                  <label htmlFor="new-scan-urls">URL a analizar</label>
                  <span>Debe ser pública</span>
                </div>
                <input
                  id="new-scan-urls"
                  required
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="https://www.tusitio.com.pe"
                  className={`scan-launch-control scan-launch-url-control ${blocksFreeScan ? 'scan-modal-control-error' : ''}`}
                  value={newScanUrls}
                  onChange={e => onNewScanUrlsChange(e.target.value)}
                  aria-describedby="scan-url-help scan-url-count"
                  aria-invalid={blocksFreeScan}
                />
              </div>

              <p id="scan-url-help" className="scan-launch-help">{urlHelpText}</p>
              <p id="scan-url-count" className={`scan-launch-url-count ${blocksFreeScan ? 'scan-url-count-error' : ''}`}>
                {urlCount === 0 ? 'Sin URL detectada' : '1 URL detectada'}
              </p>

              <fieldset className="scan-login-mode-group">
                <legend>¿Cómo se accede al sitio?</legend>
                <label className={`scan-login-mode-option scan-login-mode-public ${newScanLoginMode === 'none' ? 'scan-login-mode-option-active' : ''}`}>
                  <input
                    type="radio"
                    name="scan-login-mode"
                    value="none"
                    checked={newScanLoginMode === 'none'}
                    onChange={() => onNewScanLoginModeChange('none')}
                  />
                  <span>
                    <strong>Sitio público</strong>
                    <small>La página es accesible sin iniciar sesión. Pega la URL y lanza el análisis.</small>
                  </span>
                </label>
                <label
                  className={`scan-login-mode-option scan-login-mode-private ${newScanLoginMode === 'manual_assisted' ? 'scan-login-mode-option-active' : ''} ${isManualLoginLocked ? 'scan-login-mode-option-locked' : ''}`}
                  aria-disabled={isManualLoginLocked}
                >
                  <input
                    type="radio"
                    name="scan-login-mode"
                    value="manual_assisted"
                    checked={newScanLoginMode === 'manual_assisted'}
                    disabled={isManualLoginLocked}
                    onChange={() => {
                      if (!isManualLoginLocked) onNewScanLoginModeChange('manual_assisted');
                    }}
                  />
                  <span>
                    <strong>Sitio privado — requiere sesión</strong>
                    <small>
                      {isManualLoginLocked
                        ? 'Disponible con plan Pro. Escanea páginas que requieren inicio de sesión.'
                        : 'Usa la extensión Sin Barreras desde la pestaña donde ya iniciaste sesión. No almacenamos credenciales.'}
                    </small>
                  </span>
                </label>
                {newScanLoginMode === 'manual_assisted' && (
                  <div className="scan-extension-helper flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <div className="bg-blue-50 text-blue-900 border border-blue-200 p-3 rounded-md text-xs">
                        <p className="font-bold mb-1 text-[13px] flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" />
                          ¡Sigue estos pasos en orden!
                        </p>
                        <ol className="list-decimal pl-5 space-y-1 mt-2">
                          <li>Haz clic en <strong className="text-blue-700">Iniciar escaneo</strong> al final de esta ventana.</li>
                          <li>Los datos de Token e ID se enviarán automaticamente a tu extensión.</li>
                          <li>Ve a la pestaña que quieres analizar, abre la extensión y haz clic en <strong>Analizar</strong>.</li>
                          <li className="text-gray-500 text-[11px] mt-1 italic list-none -ml-5">Si la conexión automática falla, puedes copiar los datos de Token y ID que se mostrarán en la siguiente pantalla.</li>
                        </ol>
                      </div>
                      <a href={EXTENSION_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex">
                        <Download className="h-4 w-4" aria-hidden="true" />
                        Ir a Chrome Web Store
                      </a>
                    </div>
                  </div>
                )}
              </fieldset>

              {blocksFreeScan && (
                <div className="scan-url-limit-alert" role="alert">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {changesFreeUrl
                      ? 'Tu plan Free ya tiene una URL guardada. Reescanea esa misma URL o cambia a Pro para auditar otra.'
                      : 'Deja solo una URL para continuar. Para otra URL, crea un nuevo escaneo.'}
                  </span>
                </div>
              )}

              {parsedNewScanUrls.length > 0 && (
                <div className="scan-modal-url-tools">
                  <p>
                    Abrir URL te permite revisar la página antes de auditarla. Si requiere sesión, usa la extensión desde la pestaña autenticada.
                  </p>
                  <div className="scan-modal-url-actions">
                    <button
                      type="button"
                      className="scan-modal-secondary-btn"
                      onClick={() => openInspectionUrl(parsedNewScanUrls[0])}
                    >
                      <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      Abrir URL
                    </button>
                  </div>
                </div>
              )}

              <div className="scan-launch-modal-actions">
                <button
                  type="button"
                  className="scan-launch-secondary"
                  onClick={onCloseNewScan}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="scan-launch-submit"
                  disabled={parsedNewScanUrls.length === 0 || blocksFreeScan}
                >
                  <Zap className="h-5 w-5" aria-hidden="true" />
                  Iniciar escaneo
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      <div className="project-detail-surface report-surface page-entrance">
        <div className="flex items-center gap-10">
          <button
            onClick={onBack}
            className="report-ghost-btn report-back-btn"
            aria-label={backLabel}
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Volver</span>
          </button>
          <div>
            <div className="flex items-center gap-5 flex-nowrap">
              <h2 className="text-2xl font-bold text-white">{currentProject.name}</h2>
              <span className="report-entity-badge shrink-0">{currentProject.entityType}</span>
            </div>
            {currentProject.domain && <p className="text-slate-300 text-sm">{currentProject.domain}</p>}
          </div>
        </div>

        <div className="project-detail-history-stack">
          {hasScans && (
            <div className="project-detail-actions-row">
              <button
                onClick={onNewScanClick}
                className="report-action-btn report-action-btn-scan project-new-analysis-btn"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>Nuevo análisis</span>
              </button>
            </div>
          )}

          <div className="report-panel report-panel-spacious space-y-8 project-history-panel">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-gob-dark">Historial de análisis</h3>
              <div className="text-xs text-slate-500">Total: {currentProject.scans?.length || 0} análisis</div>
            </div>

            <ScoreTrend scans={currentProject.scans || []} />

            {!hasScans && (
              <div className="project-history-empty-state">
                <span className="project-history-empty-icon" aria-hidden="true">
                  <FileSearch className="h-6 w-6" />
                </span>
                <div>
                  <h4>Aún no hay análisis</h4>
                  <p>Lanza tu primer escaneo gratuito para generar el reporte, detectar hallazgos y revisar el cumplimiento WCAG 2.2.</p>
                </div>
                <button
                  type="button"
                  onClick={onNewScanClick}
                  className="report-action-btn report-action-btn-scan"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Lanzar análisis gratis</span>
                </button>
              </div>
            )}

            <div className="scan-history-list">
              {scans.map((scan: any) => {
                const progress = scanProgress[scan.id];
                const isRunning = scan.status === 'running' || scan.status === 'pending' || scan.status === 'awaiting_login';
                const scanPercent = getScanProgressValue(scan, progress);
                const score = typeof scan.globalScore === 'number' ? scan.globalScore : null;
                const scanToneClass = scan.status === 'cancelled'
                  ? 'scan-history-card-canceled'
                  : isRunning
                    ? 'scan-history-card-running'
                    : score === null
                      ? 'scan-history-card-pending'
                      : score >= 85
                        ? 'scan-history-card-good'
                        : score >= 70
                          ? 'scan-history-card-warning'
                          : 'scan-history-card-danger';

                return (
                  <div
                    key={scan.id}
                    onClick={() => {
                      if (isRunning) {
                        return;
                      }
                      onScanClick(scan);
                    }}
                    className={`scan-history-item ${scanToneClass} ${isRunning ? 'scan-history-item-live' : 'cursor-pointer'}`}
                  >
                    <div className="scan-history-main">
                      <div className="scan-history-title-row">
                        <div>
                          <span className="scan-history-url">{getScanDisplayUrl(scan)}</span>
                          {renderStatusBadge(scan.status)}
                          {isRunning && onCancelScan && (
                            <button
                              type="button"
                              className="report-danger-icon-btn"
                              aria-label="Cancelar escaneo"
                              disabled={cancellingScanId === scan.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                setCancellingScanId(scan.id);
                                Promise.resolve(onCancelScan(scan.id)).finally(() => setCancellingScanId(null));
                              }}
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                          {!isRunning && (
                            <button
                              type="button"
                              className="report-danger-icon-btn"
                              aria-label={`Eliminar ${getScanModeLabel(scan.scanMode)}`}
                              onClick={(event) => onDeleteScan(scan, event)}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="scan-history-meta-row">
                        <span className="scan-history-mode-tag">{getScanModeLabel(scan.scanMode)}</span>
                        <span className="scan-history-date">
                          <Clock className="h-3 w-3" />
                          {new Date(scan.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {isRunning ? (
                      <div className="scan-history-result scan-history-result-running" style={scan.status === 'awaiting_login' ? { flexDirection: 'column', alignItems: 'flex-start' } : undefined}>
                        <div className="scan-progress-block">
                          <div className="scan-progress-header">
                            <span className="scan-progress-stage">{getScanStatusLabel(scan.status, scanPercent)}</span>
                            <span className="scan-progress-pct">{scanPercent}%</span>
                          </div>
                          <div className="scan-progress-track">
                            <div className="scan-progress-fill" style={{ width: `${scanPercent}%` }} />
                          </div>
                          <span className="scan-progress-hint">Analizando accesibilidad en tiempo real</span>
                        </div>

                        {scan.status === 'awaiting_login' && (
                          <div className="w-full bg-slate-50 p-4 rounded-md border border-slate-200 mt-4 text-sm" onClick={(e) => e.stopPropagation()}>
                            <p className="font-semibold text-slate-800 mb-1">Instrucciones para la extensión:</p>
                            <p className="text-slate-600 mb-4">
                              Abre la pestaña que quieres escanear y abre la extensión. Los datos del escaneo se envían
                              automáticamente. Finalmente, haz clic en <strong>Analizar</strong>.
                            </p>
                            <div className="mt-2 pt-2 border-t border-slate-200">
                              <span className="block text-[11px] font-bold text-slate-500 mb-1">ID DEL ESCANEO</span>
                              <div
                                className="flex items-center justify-between w-full bg-slate-100 border border-slate-200 p-2 rounded cursor-pointer hover:bg-slate-200 transition-colors mt-1"
                                onClick={() => handleCopy(scan.id)}
                                title="Copiar ID"
                              >
                                <code className="text-slate-800 select-all text-xs">{scan.id}</code>
                                {copiedId
                                  ? <Check className="h-4 w-4 text-green-600 flex-shrink-0 ml-2" />
                                  : <Copy className="h-4 w-4 text-slate-400 flex-shrink-0 ml-2" />}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : scan.status === 'cancelled' ? (
                      <div className="scan-history-result scan-history-result-cancelled">
                        <span className="scan-history-cancelled-label">Escaneo cancelado</span>
                      </div>
                    ) : (
                      <div className="scan-history-result">
                        {renderScoreMeter(scan.globalScore, 'Puntaje')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {hasMoreScans && (
              <div style={{ textAlign: 'center', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={onLoadMoreScans}
                  disabled={loadingMoreScans}
                  style={{
                    background: 'none',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '0.4rem 1.2rem',
                    color: '#334155',
                    cursor: loadingMoreScans ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem',
                    opacity: loadingMoreScans ? 0.6 : 1,
                  }}
                >
                  {loadingMoreScans ? 'Cargando...' : 'Ver más escaneos'}
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
