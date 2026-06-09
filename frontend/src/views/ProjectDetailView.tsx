import React from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Download,
  FileSearch,
  Link as LinkIcon,
  RefreshCw,
  Trash2,
  X,
  Zap,
} from 'lucide-react';

const EXTENSION_DOWNLOAD_URL = '/downloads/sin-barreras-extension.zip';

interface ProjectDetailViewProps {
  currentProject: any;
  onBack: () => void;
  backLabel?: string;
  onNewScanClick: () => void;
  onScanClick: (scan: any) => void;
  onDeleteScan: (scan: any, event: React.MouseEvent) => void;
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
  getVpCategory: (vp: number | null) => { label: string; color: string };
  openInspectionUrl: (url: string) => void;
  extensionApiBaseUrl?: string;
  extensionAccessToken?: string;
}

export function ProjectDetailView({
  currentProject,
  onBack,
  backLabel = 'Volver a proyectos',
  onNewScanClick,
  onScanClick,
  onDeleteScan,
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
  getVpCategory,
  openInspectionUrl,
}: ProjectDetailViewProps) {
  const urlCount = parsedNewScanUrls.length;
  const scans = [...(currentProject.scans || [])].sort((a: any, b: any) => {
    const bTime = new Date(b.createdAt || 0).getTime();
    const aTime = new Date(a.createdAt || 0).getTime();
    return bTime - aTime;
  });
  const hasScans = scans.length > 0;
  const newScanDialogRef = React.useRef<HTMLDivElement>(null);
  const onCloseNewScanRef = React.useRef(onCloseNewScan);

  React.useEffect(() => {
    onCloseNewScanRef.current = onCloseNewScan;
  }, [onCloseNewScan]);

  React.useEffect(() => {
    if (!showNewScan) return;
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
    if (scanMode === 'rápido') return 'análisis rápido de accesibilidad';
    if (scanMode === 'profundo') return 'análisis profundo de accesibilidad';
    return 'análisis especializado de accesibilidad';
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
    const rawProgress = progress ?? scan.progress ?? scan.scanProgress ?? (scan.status === 'completed' ? 100 : 0);
    const numericProgress = Number(rawProgress);
    if (!Number.isFinite(numericProgress)) return 0;
    return Math.max(0, Math.min(100, Math.round(numericProgress)));
  };

  const getScanStatusLabel = (status: string, progress: number) => {
    if (status === 'awaiting_login') return 'Login manual pendiente';
    if (status === 'pending') return 'En cola';
    if (status === 'completed') return 'Completado';
    if (status === 'failed') return 'Falló';
    if (progress >= 95) return 'Finalizando';
    return 'Corriendo';
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
              <legend>Acceso al sitio</legend>
              <label className={`scan-login-mode-option ${newScanLoginMode === 'none' ? 'scan-login-mode-option-active' : ''}`}>
                <input
                  type="radio"
                  name="scan-login-mode"
                  value="none"
                  checked={newScanLoginMode === 'none'}
                  onChange={() => onNewScanLoginModeChange('none')}
                />
                <span>
                  <strong>Escaneo público</strong>
                  <small>Usa esta opción si la página puede evaluarse sin iniciar sesión.</small>
                </span>
              </label>
              <label
                className={`scan-login-mode-option ${newScanLoginMode === 'manual_assisted' ? 'scan-login-mode-option-active' : ''} ${isManualLoginLocked ? 'scan-login-mode-option-locked' : ''}`}
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
                  <strong>Login manual asistido</strong>
                  <small>
                    {isManualLoginLocked
                      ? 'Disponible con suscripción para escanear páginas privadas o con sesión.'
                      : 'Usa la extensión Sin Barreras en la pestaña donde ya iniciaste sesión. No guardamos contraseñas, cookies ni sesiones.'}
                  </small>
                </span>
              </label>
              {newScanLoginMode === 'manual_assisted' && (
                <div className="scan-extension-helper">
                  <div>
                    <strong>Extensión para sitios con login</strong>
                    <small>Descárgala, instálala en Chrome o Edge y ejecútala desde la pestaña autenticada. Los resultados se enviarán al reporte del sistema.</small>
                  </div>
                  <a href={EXTENSION_DOWNLOAD_URL} download>
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Descargar extensión
                  </a>
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
              const scanToneClass = isRunning
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
                        <span>{getScanModeLabel(scan.scanMode)}</span>
                        {renderStatusBadge(scan.status)}
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
                    <div className="scan-history-date">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(scan.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {isRunning ? (
                    <div className="scan-history-result">
                      <div className="scan-history-priority">
                        <span>Progreso</span>
                        <strong>{scanPercent}%</strong>
                      </div>
                      <div className="scan-progress-track">
                        <div className="scan-progress-fill" style={{ width: `${scanPercent}%` }} />
                      </div>
                      <div className="scan-history-priority">
                        <span>{getScanStatusLabel(scan.status, scanPercent)}</span>
                        <span className="text-gob-blue">Actualizando</span>
                      </div>
                    </div>
                  ) : (
                    <div className="scan-history-result">
                      {renderScoreMeter(scan.globalScore, 'Puntaje')}
                      <div className="scan-history-priority">
                        <span>Priorización (Vp)</span>
                        <span className={getVpCategory(scan.vp).color}>
                          {getVpCategory(scan.vp).label} ({scan.vp})
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
    </>
  );
}
