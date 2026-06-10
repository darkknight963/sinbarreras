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
  getVpCategory,
  openInspectionUrl,
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
  const [copiedToken, setCopiedToken] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState(false);

  const handleCopy = async (text: string, type: 'token' | 'id') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'token') {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      } else {
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      }
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
    if (scanMode === 'rápido') return 'análisis rápido de accesibilidad';
    if (scanMode === 'profundo') return 'análisis profundo de accesibilidad';
    return 'Escaneando sitio: Verificando estándares de accesibilidad...';
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
    if (status === 'running') return 'Corriendo';
    if (status === 'completed') return 'Completado';
    if (status === 'failed') return 'Falló';
    if (status === 'cancelled') return 'Cancelado';
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
                <div className="scan-extension-helper flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <div>
                      <strong>Extensión para sitios con login</strong>
                      <small>Descárgala de la Chrome Web Store y ejecútala en tu sitio web. Copia los siguientes datos y pégalos en la extensión:</small>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 mt-2">
                      <div>
                        <span className="block text-[11px] font-bold text-slate-500 mb-1">TOKEN DE ACCESO</span>
                        <div
                          className="flex items-center justify-between w-full bg-slate-100 border border-slate-200 p-2 rounded cursor-pointer hover:bg-slate-200 transition-colors"
                          onClick={() => handleCopy(typeof window !== 'undefined' ? window.localStorage.getItem('sin-barreras-session-token')?.trim() || '' : '', 'token')}
                          title="Copiar token"
                        >
                          <code className="text-slate-800 select-all overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                            {typeof window !== 'undefined' ? window.localStorage.getItem('sin-barreras-session-token')?.trim() || 'Inicia sesión para obtener tu token' : ''}
                          </code>
                          {copiedToken ? <Check className="h-4 w-4 text-green-600 flex-shrink-0 ml-2" /> : <Copy className="h-4 w-4 text-slate-400 flex-shrink-0 ml-2" />}
                        </div>
                      </div>
                      <div>
                        <span className="block text-[11px] font-bold text-slate-500 mb-1">ID DEL ESCANEO</span>
                        <div
                          className="flex items-center justify-between w-full bg-slate-100 border border-slate-200 p-2 rounded cursor-pointer hover:bg-slate-200 transition-colors"
                          onClick={() => handleCopy(pendingScanId, 'id')}
                          title="Copiar ID"
                        >
                          <code className="text-slate-800 select-all text-xs">
                            {pendingScanId}
                          </code>
                          {copiedId ? <Check className="h-4 w-4 text-green-600 flex-shrink-0 ml-2" /> : <Copy className="h-4 w-4 text-slate-400 flex-shrink-0 ml-2" />}
                        </div>
                      </div>
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
                        <span>{getScanModeLabel(scan.scanMode)}</span>
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
                    <div className="scan-history-date">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(scan.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {isRunning ? (
                    <div className="scan-history-result" style={scan.status === 'awaiting_login' ? { flexDirection: 'column', alignItems: 'flex-start' } : undefined}>
                      <div className="flex w-full items-center justify-between" style={scan.status === 'awaiting_login' ? { width: '100%' } : undefined}>
                        <div className="scan-history-priority">
                          <span>Progreso</span>
                          <strong>{scanPercent}%</strong>
                        </div>
                        <div className="scan-progress-track flex-1 mx-4">
                          <div className="scan-progress-fill" style={{ width: `${scanPercent}%` }} />
                        </div>
                        <div className="scan-history-priority text-right">
                          <span>{getScanStatusLabel(scan.status, scanPercent)}</span>
                          <span className="text-gob-blue">Actualizando</span>
                        </div>
                      </div>

                      {scan.status === 'awaiting_login' && (
                        <div className="w-full bg-slate-50 p-4 rounded-md border border-slate-200 mt-4 text-sm" onClick={(e) => e.stopPropagation()}>
                          <p className="font-semibold text-slate-800 mb-1">Instrucciones para la extensión:</p>
                          <p className="text-slate-600 mb-4">Abre la extensión de Sin Barreras en la pestaña donde tienes la sesión iniciada y copia los siguientes datos:</p>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <span className="block text-xs font-bold text-slate-500 mb-1">TOKEN DE ACCESO (Haz clic para seleccionar)</span>
                              <code className="block w-full bg-white border border-slate-300 p-2.5 rounded text-slate-800 select-all overflow-hidden text-ellipsis whitespace-nowrap">
                                {typeof window !== 'undefined' ? window.localStorage.getItem('sin-barreras-session-token')?.trim() || 'Inicia sesión para obtener tu token' : ''}
                              </code>
                            </div>
                            <div>
                              <span className="block text-xs font-bold text-slate-500 mb-1">ID DEL ESCANEO (Haz clic para seleccionar)</span>
                              <code className="block w-full bg-white border border-slate-300 p-2.5 rounded text-slate-800 select-all">
                                {scan.id}
                              </code>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : scan.status === 'cancelled' ? (
                    <div className="scan-history-result">
                      <div className="scan-history-priority">
                        <span>Escaneo cancelado</span>
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
