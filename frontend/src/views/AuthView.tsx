import React, { useState } from 'react';
import {
  ArrowUpRight,
  Cog,
  Eye,
  EyeOff,
  FileCheck2,
  Globe2,
  Landmark,
  Lock,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';

type LegalPanel = 'terms' | 'returns' | 'complaints';

interface AuthViewProps {
  authFormMode: 'login' | 'register';
  onToggleMode: () => void;
  onSetMode?: (mode: 'login' | 'register') => void;
  authEmail: string;
  onEmailChange: (value: string) => void;
  authPassword: string;
  onPasswordChange: (value: string) => void;
  authFullName: string;
  onFullNameChange: (value: string) => void;
  authCompanyName: string;
  onCompanyNameChange: (value: string) => void;
  authSubmitting: boolean;
  guestSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onStartGuest: () => void;
  onViewPlans: () => void;
  onGoogleLogin: () => void;
  appError: string | null;
  useDemoCredentials: () => void;
  onSubmitComplaint: (payload: {
    fullName: string;
    document: string;
    email: string;
    phone: string;
    type: 'reclamo' | 'queja';
    service: string;
    detail: string;
    request: string;
  }) => Promise<void>;
  forceOpenAccessPanel?: boolean;
}

export function AuthView({
  authFormMode,
  onToggleMode,
  onSetMode,
  authEmail,
  onEmailChange,
  authPassword,
  onPasswordChange,
  authFullName,
  onFullNameChange,
  authCompanyName,
  onCompanyNameChange,
  authSubmitting,
  guestSubmitting,
  onSubmit,
  onStartGuest,
  onViewPlans,
  onGoogleLogin,
  appError,
  useDemoCredentials,
  onSubmitComplaint,
  forceOpenAccessPanel,
}: AuthViewProps) {
  const [showAccessPanel, setShowAccessPanel] = useState(false);
  const [activeLegalPanel, setActiveLegalPanel] = useState<LegalPanel | null>(null);
  const [complaintNotice, setComplaintNotice] = useState<string | null>(null);
  const [complaintError, setComplaintError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const accessPanelRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (forceOpenAccessPanel) {
      setShowAccessPanel(true);
    }
  }, [forceOpenAccessPanel]);

  // Focus trap + Escape en el modal de acceso (criterios 2.1.2 y 2.4.3):
  // el foco no debe escapar al contenido de fondo y el modal debe poder
  // cerrarse con teclado. Al abrir, enfoca el primer campo; al cerrar,
  // el foco vuelve de forma natural al documento.
  React.useEffect(() => {
    if (!showAccessPanel) return;

    const panel = accessPanelRef.current;
    if (!panel) return;

    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const firstField = panel.querySelector<HTMLElement>('input, button');
    firstField?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowAccessPanel(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showAccessPanel, authFormMode]);

  const openAccessPanel = () => setShowAccessPanel(true);

  const handleNavLoginClick = () => {
    if (onSetMode) onSetMode('login');
    openAccessPanel();
  };

  const closeAccessPanel = () => setShowAccessPanel(false);
  const handleStartGuest = () => onStartGuest();
  const openLegalPanel = (panel: LegalPanel) => {
    setComplaintNotice(null);
    setComplaintError(null);
    setActiveLegalPanel(panel);
  };
  const closeLegalPanel = () => setActiveLegalPanel(null);
  const handleComplaintSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      await onSubmitComplaint({
        fullName: String(data.get('fullName') || ''),
        document: String(data.get('document') || ''),
        email: String(data.get('email') || ''),
        phone: String(data.get('phone') || ''),
        type: String(data.get('type') || 'reclamo') as 'reclamo' | 'queja',
        service: String(data.get('service') || ''),
        detail: String(data.get('detail') || ''),
        request: String(data.get('request') || ''),
      });
      setComplaintError(null);
      setComplaintNotice('Tu registro fue recibido en el Libro de Reclamaciones virtual. Conserva una copia de la informacion enviada.');
      form.reset();
    } catch (error) {
      setComplaintNotice(null);
      setComplaintError(error instanceof Error ? error.message : 'No se pudo registrar el reclamo.');
    }
  };

  return (
    <div className="auth-landing min-h-screen">
      <header className="auth-landing-nav">
        <a className="auth-landing-brand" href="#top" aria-label="Sin Barreras inicio">
          <span className="auth-landing-logo" aria-hidden="true">
            <img src="/sin-barreras-icon.png" alt="" className="h-6 w-6 object-contain" />
          </span>
          <span>Sin Barreras</span>
        </a>
        <nav aria-label="Principal">
          <a href="#how-it-works">C&oacute;mo funciona</a>
          <a href="#normative-coverage">Cobertura normativa</a>
          <button type="button" onClick={onViewPlans} disabled={guestSubmitting}>Planes</button>
          <button type="button" className="auth-nav-login" onClick={handleNavLoginClick}>Iniciar sesi&oacute;n</button>
        </nav>
      </header>

      <main id="top" className="auth-landing-main">
        <section className="auth-landing-hero">
          <div className="auth-hero-chip">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>WCAG 2.2 &bull; Ley N&deg; 29973</span>
          </div>
          <h1>
            &iquest;Tu sitio web<br />
            cumple con las<br />
            normativas de<br />
            <span>accesibilidad</span><br />
            digital?
          </h1>
          <p>
            Un an&aacute;lisis completo de accesibilidad con reportes para tu equipo, tu cliente y tu auditor.
            Solo pega tu URL.
          </p>
          <div className="auth-hero-actions">
            <button type="button" onClick={handleStartGuest} disabled={guestSubmitting}>
              <Zap className="h-4 w-4" aria-hidden="true" />
              {guestSubmitting ? 'Preparando auditor\u00eda...' : 'Analizar mi sitio gratis'}
            </button>
          </div>
        </section>

        <section className="auth-browser-preview auth-report-preview" aria-label="Ejemplo de auditoria">
          <p className="auth-report-preview-kicker">Vista previa de tu reporte</p>
          <div className="auth-browser-top">
            <div className="auth-window-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <span className="auth-browser-url">
              sinbarreras.com/reporte/miecommerce.com.pe
            </span>
          </div>
          <div className="auth-browser-body auth-report-preview-body">
            <div className="auth-report-preview-card">
              <div className="auth-report-preview-head">
                <div>
                  <h2>Reporte de accesibilidad &mdash; miecommerce.com.pe</h2>
                  <p>Resultados agrupados por problema &middot; WCAG 2.2 (ISO/IEC 40500:2025)</p>
                </div>
                <section className="auth-report-preview-badges" aria-labelledby="auth-report-preview-badges-title">
                  <h3 id="auth-report-preview-badges-title" className="visually-hidden">Resumen de hallazgos</h3>
                  <span className="auth-preview-badge auth-preview-badge-error">18 errores</span>
                  <span className="auth-preview-badge auth-preview-badge-review">19 revisiones</span>
                  <span className="auth-preview-badge auth-preview-badge-elements">138 elementos</span>
                </section>
              </div>

              <section className="auth-report-preview-metrics" aria-labelledby="auth-report-preview-metrics-title">
                <h3 id="auth-report-preview-metrics-title" className="visually-hidden">Metricas del reporte</h3>
                <div><span>Total</span><strong>86</strong></div>
                <div><span>Aplican</span><strong>55</strong></div>
                <div><span>Cumplen</span><strong className="auth-preview-good">43</strong></div>
                <div><span>Fallan</span><strong className="auth-preview-bad">8</strong></div>
                <div><span>Revisión</span><strong className="auth-preview-warn">4</strong></div>
              </section>

              <div className="auth-report-preview-section-title">Resultados agrupados por problema</div>
              <div className="auth-report-preview-findings">
                {[
                  ['error', '1 error', 'Contraste de color insuficiente', 'Confirmado - 5 elementos afectados - Criterio 1.4.3', 'Alto'],
                  ['error', '1 error', 'Campo de formulario sin etiqueta accesible', 'Confirmado - 1 elemento afectado - Criterio 1.3.1', 'Alto'],
                  ['review', 'revision', 'Contenido no textual', 'Requiere revision - 1 hallazgo - Criterio 1.1.1', 'Medio'],
                  ['pass', 'aprobado', 'Navegacion por teclado', 'Funciona correctamente - Criterio 2.1.1', 'OK'],
                ].map(([type, count, title, detail, severity]) => (
                  <article key={title} className={`auth-report-preview-finding auth-preview-${type}`}>
                    <span>{count}</span>
                    <div>
                      <strong>{title}</strong>
                      <small>{detail}</small>
                    </div>
                    <em>{severity}</em>
                  </article>
                ))}
              </div>

              <div className="auth-report-preview-footer">
                <span><Lock className="h-3.5 w-3.5" aria-hidden="true" /> Exportar PDF y Excel requiere plan Pro</span>
                <button type="button" onClick={openAccessPanel}>
                  Ver reporte completo
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="auth-how-section">
          <section id="normative-coverage" className="auth-standards-block" aria-labelledby="auth-standards-title">
            <span className="auth-section-eyebrow">Cobertura normativa</span>
            <h3 id="auth-standards-title">Analiza tu sitio bas&aacute;ndose en est&aacute;ndares globales y la normativa peruana vigente.</h3>
            <p className="auth-standards-intro">
              Nuestra herramienta eval&uacute;a cada criterio bas&aacute;ndose en los marcos t&eacute;cnicos y legales vigentes,
              para que tu reporte tenga respaldo real.
            </p>
            <div className="auth-standards-grid">
              <article className="auth-standard-card auth-standard-card-international">
                <span><Globe2 className="h-4 w-4" aria-hidden="true" /></span>
                <small>Internacional</small>
                <strong>WCAG 2.2</strong>
                <p>
                  Pautas de Accesibilidad para el Contenido Web. El est&aacute;ndar t&eacute;cnico de referencia global.
                </p>
                <em>Incluido</em>
              </article>
              <article className="auth-standard-card auth-standard-card-technical">
                <span><Cog className="h-4 w-4" aria-hidden="true" /></span>
                <small>Norma t&eacute;cnica</small>
                <strong>ISO/IEC 40500:2025</strong>
                <p>
                  Adopta WCAG 2.2 como norma internacional. Criterio de calidad reconocido en auditor&iacute;as corporativas.
                </p>
                <em>Incluido</em>
              </article>
              <article className="auth-standard-card auth-standard-card-pcm">
                <span><Landmark className="h-4 w-4" aria-hidden="true" /></span>
                <small>Per&uacute; &mdash; PCM</small>
                <strong>Res. 001-2025-PCM/SGTD</strong>
                <p>
                  Lineamiento obligatorio para el dise&ntilde;o y desarrollo de servicios digitales del Estado peruano.
                </p>
                <em>Incluido</em>
              </article>
              <article className="auth-standard-card auth-standard-card-law">
                <span><ShieldCheck className="h-4 w-4" aria-hidden="true" /></span>
                <small>Per&uacute; &mdash; Ley</small>
                <strong>Ley N&deg; 29973</strong>
                <p>
                  Ley General de la Persona con Discapacidad. Marco legal para el cumplimiento normativo en el pa&iacute;s.
                </p>
                <em>Incluido</em>
              </article>
              <article className="auth-standard-card auth-standard-card-deliverable">
                <span><FileCheck2 className="h-4 w-4" aria-hidden="true" /></span>
                <small>Entregable</small>
                <strong>Reporte con valor t&eacute;cnico</strong>
                <p>
                  Informe estructurado listo para presentar en auditor&iacute;as internas o procesos de licitaci&oacute;n p&uacute;blica.
                </p>
                <em>Plan Pro</em>
              </article>
            </div>
            <div className="auth-standards-note">
              <span aria-hidden="true">i</span>
              <p>
                <strong>Sin Barreras eval&uacute;a en base a estos est&aacute;ndares</strong> &mdash; no emite certificaciones oficiales.
                El reporte documenta el nivel de cumplimiento de tu sitio.
              </p>
            </div>
          </section>

          <div id="how-it-works" className="auth-process-heading">
            <span className="auth-section-eyebrow">C&oacute;mo funciona</span>
            <h2>De la URL al reporte en segundos</h2>
            <p>Sin instalar nada. Sin configurar nada. Solo pega tu URL.</p>
          </div>

          <section className="auth-flow-timeline" aria-labelledby="auth-flow-timeline-title">
            <h2 id="auth-flow-timeline-title" className="visually-hidden">Flujo de auditoria</h2>
            <article className="auth-flow-step auth-flow-step-free">
              <span className="auth-flow-icon"><Globe2 className="h-5 w-5" aria-hidden="true" /></span>
              <div className="auth-flow-copy">
                <small>Gratis</small>
                <strong>Pega tu URL y escanea</strong>
                <p>Sin registro previo. Cualquier sitio p&uacute;blico funciona. El an&aacute;lisis empieza al instante.</p>
              </div>
            </article>

            <article className="auth-flow-step auth-flow-step-preview">
              <span className="auth-flow-icon"><Lock className="h-5 w-5" aria-hidden="true" /></span>
              <div className="auth-flow-copy">
                <small>Vista previa</small>
                <strong>Ve cu&aacute;ntos problemas tiene tu sitio</strong>
                <p>Obtienes el conteo total de errores, revisiones y severidad. El detalle completo se desbloquea al suscribirte.</p>
                <div className="auth-flow-locked-preview" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <Lock className="h-4 w-4" />
                </div>
              </div>
            </article>

            <article className="auth-flow-step auth-flow-step-pro">
              <span className="auth-flow-icon"><FileCheck2 className="h-5 w-5" aria-hidden="true" /></span>
              <div className="auth-flow-copy">
                <small>Plan Pro</small>
                <strong>Accede al reporte completo</strong>
                <p>Errores, criterios WCAG, soluciones y exportaci&oacute;n PDF / Excel listos para entregar a tu cliente.</p>
                <div className="auth-flow-report-card" aria-hidden="true">
                  <div>
                    <strong>miecommerce.com.pe</strong>
                    <span>18 errores</span>
                    <span>19 revisiones</span>
                    <span>43 ok</span>
                  </div>
                  <p><b />Contraste de color insuficiente <em>Alto</em></p>
                  <p><b />Contenido no textual <em>Medio</em></p>
                  <p><b />Navegaci&oacute;n por teclado <em>OK</em></p>
                </div>
              </div>
            </article>

            <aside className="auth-flow-extension">
              <span><Cog className="h-5 w-5" aria-hidden="true" /></span>
              <div>
                <strong>&iquest;Tu sitio requiere login?</strong>
                <p>Instala la extensi&oacute;n de Chrome y escanea p&aacute;ginas privadas con la misma profundidad.</p>
              </div>
              <button type="button" onClick={handleStartGuest} disabled={guestSubmitting}>Extensi&oacute;n gratuita</button>
            </aside>
          </section>
        </section>

        <section className="auth-final-cta" aria-label="Comenzar analisis">
          <h2>Analiza tu sitio ahora - es gratis</h2>
          <button type="button" onClick={handleStartGuest} disabled={guestSubmitting}>
            {guestSubmitting ? 'Preparando...' : 'Empezar gratis'}
          </button>
        </section>

        {showAccessPanel && (
          <div className="auth-access-modal-overlay" role="presentation">
            <section
              id="auth-access-panel"
              ref={accessPanelRef}
              className={`auth-access-panel auth-access-modal ${authFormMode === 'login' ? 'auth-access-modal-login' : 'auth-access-modal-register'}`}
              aria-label="Acceso a cuenta"
              aria-modal="true"
              role="dialog"
              onClick={(event) => event.stopPropagation()}
            >
              <button type="button" className="auth-access-close" aria-label="Cerrar acceso" onClick={closeAccessPanel}>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>

              <form className="auth-form auth-landing-form" onSubmit={onSubmit}>
                <div className={`auth-login-head ${authFormMode === 'register' ? 'auth-register-head' : ''}`}>
                  <span>Acceso seguro</span>
                  <h2>{authFormMode === 'register' ? 'Crear cuenta' : 'Iniciar sesi\u00f3n'}</h2>
                  <p>
                    {authFormMode === 'register'
                      ? 'Guarda auditor\u00edas y desbloquea exportes.'
                      : 'Accede a tus proyectos e historial.'}
                  </p>
                </div>

                <button
                  type="button"
                  className="auth-google-button"
                  onClick={onGoogleLogin}
                >
                  <svg viewBox="0 0 48 48" className="auth-google-icon" aria-hidden="true">
                    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                  </svg>
                  <span>Continuar con Google</span>
                </button>

                <div className="auth-divider" role="separator">
                  <span>o con correo</span>
                </div>

                {import.meta.env.DEV && authFormMode === 'login' && (
                  <div className="auth-demo-inline">
                    <button type="button" onClick={useDemoCredentials} className="auth-demo-link">
                      Usar cuenta maestra
                    </button>
                  </div>
                )}

                <label className="auth-field grid gap-2">
                  <span className="auth-field-label">Correo</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={authEmail}
                    onChange={(e) => onEmailChange(e.target.value)}
                    className="auth-input"
                    placeholder="tu@empresa.com"
                  />
                </label>

                <label className="auth-field grid gap-2">
                  <span className="auth-field-label">Contrase&ntilde;a</span>
                  <div className="auth-input-shell relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      autoComplete={authFormMode === 'register' ? 'new-password' : 'current-password'}
                      value={authPassword}
                      onChange={(e) => onPasswordChange(e.target.value)}
                      className="auth-input auth-input-password"
                      placeholder={authFormMode === 'register' ? 'Mínimo 8 caracteres' : '********'}
                    />
                    <button
                      type="button"
                      className="auth-input-icon hover:text-slate-900 transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                    >
                      {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </button>
                  </div>
                </label>

                {authFormMode === 'register' && (
                  <div className="auth-field-grid">
                    <label className="auth-field grid gap-2">
                      <span className="auth-field-label">Nombre completo</span>
                      <input
                        type="text"
                        required
                        minLength={2}
                        autoComplete="name"
                        value={authFullName}
                        onChange={(e) => onFullNameChange(e.target.value)}
                        className="auth-input"
                        placeholder="Tu nombre"
                      />
                    </label>
                    <label className="auth-field grid gap-2">
                      <span className="auth-field-label">Empresa <span className="auth-field-optional">(opcional)</span></span>
                      <input
                        type="text"
                        autoComplete="organization"
                        value={authCompanyName}
                        onChange={(e) => onCompanyNameChange(e.target.value)}
                        className="auth-input"
                        placeholder="Organizaci&oacute;n"
                      />
                    </label>
                  </div>
                )}

                {appError && <div className="auth-error">{appError}</div>}

                <div className="auth-form-footer">
                  <p className="auth-form-note">
                    <Lock className="auth-form-note-icon" aria-hidden="true" />
                    <span>Sesi&oacute;n segura con cifrado.</span>
                  </p>
                  <button type="submit" disabled={authSubmitting} className="auth-submit-button">
                    {authSubmitting ? (
                      'Procesando...'
                    ) : (
                      <span className="auth-submit-label">
                        <span>{authFormMode === 'register' ? 'Crear cuenta' : 'Entrar'}</span>
                        <ArrowUpRight className="auth-submit-arrow" aria-hidden="true" />
                      </span>
                    )}
                  </button>
                  <p className="auth-login-switch">
                    {authFormMode === 'register' ? '\u00bfYa tienes cuenta? ' : '\u00bfNo tienes cuenta? '}
                    <button type="button" onClick={onToggleMode}>
                      {authFormMode === 'register' ? 'Iniciar sesi\u00f3n' : 'Crear cuenta'}
                    </button>
                  </p>
                </div>
              </form>
            </section>
          </div>
        )}
      </main>
      <footer className="auth-landing-footer">
        <a className="auth-landing-brand" href="#top" aria-label="Sin Barreras inicio">
          <span className="auth-landing-logo" aria-hidden="true">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span>Sin Barreras</span>
        </a>
        <nav aria-label="Legal">
          <button type="button" onClick={() => openLegalPanel('terms')}>T&eacute;rminos y Condiciones</button>
          <button type="button" onClick={() => openLegalPanel('returns')}>Cambios y devoluciones</button>
          <button type="button" onClick={() => openLegalPanel('complaints')}>Libro de reclamaciones</button>
        </nav>
        <span>&copy; 2026 Sin Barreras &middot; Lima, Per&uacute;</span>
      </footer>

    { activeLegalPanel && (
      <div className="auth-legal-modal-overlay" role="presentation" onClick={closeLegalPanel}>
        <section
          className="auth-legal-modal"
          aria-modal="true"
          role="dialog"
          aria-label="Informaci&oacute;n legal"
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" className="auth-access-close" aria-label="Cerrar informaci&oacute;n legal" onClick={closeLegalPanel}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          {activeLegalPanel === 'terms' && (
            <div className="auth-legal-content">
              <span className="auth-section-eyebrow">Informaci&oacute;n legal</span>
              <h2>T&eacute;rminos y Condiciones</h2>
              <p>
                Bienvenido a Sin Barreras. Al acceder, registrarse o utilizar esta plataforma digital de an&aacute;lisis de accesibilidad web
                (en adelante, "la Plataforma"), usted acepta estar sujeto a los siguientes T&eacute;rminos y Condiciones. Si no est&aacute; de acuerdo
                con alguno de ellos, deber&aacute; abstenerse de utilizar nuestros servicios.
              </p>
              <h3>1. Objeto del Servicio y Alcance T&eacute;cnico</h3>
              <p>
                Sin Barreras brinda una herramienta automatizada de software orientada al an&aacute;lisis preventivo de accesibilidad web,
                basada en las Pautas de Accesibilidad para el Contenido Web (WCAG en sus versiones vigentes), la normativa peruana aplicable
                (Ley N&deg; 29973) y/o los est&aacute;ndares internacionales de accesibilidad an&aacute;logos seg&uacute;n corresponda. Los reportes, auditor&iacute;as
                y sugerencias de remediaci&oacute;n generados por la Plataforma tienen una finalidad exclusivamente informativa, t&eacute;cnica y de apoyo
                orientativo para procesos de mejora continua.
              </p>
              <h3>2. Exclusi&oacute;n de Responsabilidad (Disclaimer Cr&iacute;tico)</h3>
              <ul>
                <li><strong>No emisi&oacute;n de certificaciones oficiales:</strong> El Titular de la Plataforma no es una entidad certificadora ni emite resoluciones de conformidad legal oficial. Los reportes emitidos son an&aacute;lisis t&eacute;cnicos automatizados y no garantizan la inmunidad del usuario frente a inspecciones, auditor&iacute;as del Estado o denuncias de terceros.</li>
                <li><strong>Inexistencia de garant&iacute;a de infalibilidad:</strong> Debido a la naturaleza cambiante del software y de los entornos web, las evaluaciones autom&aacute;ticas pueden no detectar el 100% de las barreras de accesibilidad existentes. No se garantiza que el uso de estos reportes resulte en un sitio web completamente accesible o inmune a sanciones.</li>
                <li><strong>Exclusi&oacute;n de da&ntilde;os:</strong> El Titular de la Plataforma no ser&aacute; responsable bajo ninguna circunstancia por sanciones administrativas, multas impuestas por organismos como Indecopi, Conadis u otros, demandas judiciales, p&eacute;rdida de datos, perjuicios econ&oacute;micos o reclamos de terceros derivados del nivel de accesibilidad real del sitio web del usuario, ni por el uso o interpretaci&oacute;n que este le d&eacute; a los reportes.</li>
              </ul>
              <h3>3. Responsabilidad del Usuario</h3>
              <p>
                El usuario declara y garantiza que es propietario de las URLs ingresadas para evaluaci&oacute;n o que cuenta con la autorizaci&oacute;n expresa
                y de ley para someter dichos sitios web a an&aacute;lisis. El usuario asume total responsabilidad por cualquier conflicto derivado del
                escaneo de plataformas de terceros sin consentimiento.
              </p>
              <h3>4. Limitaciones T&eacute;cnicas del Servicio</h3>
              <p>
                El usuario reconoce y acepta que la precisi&oacute;n de los resultados generados puede verse afectada o imposibilitada por factores ajenos
                al control del Titular, tales como:
              </p>
              <ul>
                <li>Ca&iacute;das o indisponibilidad del sitio web evaluado.</li>
                <li>Cambios din&aacute;micos de contenido en tiempo real en la web del cliente.</li>
                <li>Bloqueos de seguridad perimetral (Firewalls, Cloudflare, WAF) implementados por el cliente.</li>
                <li>P&aacute;ginas que requieran inicios de sesi&oacute;n (logins) o pasarelas de pago protegidas.</li>
              </ul>
              <h3>5. Planes de Pago y Suscripciones</h3>
              <p>
                Los planes de pago contratados habilitan funcionalidades adicionales seg&uacute;n las caracter&iacute;sticas y vigencia estipuladas en la tabla de planes.
                El Titular se reserva el derecho de modificar las tarifas, notificando a los usuarios activos con una anticipaci&oacute;n razonable.
              </p>
              <h3>6. Contacto y Soporte</h3>
              <p className="auth-legal-note">Para consultas relacionadas con contrataciones, incidencias t&eacute;cnicas o soporte, el canal oficial y exclusivo es: administrador@gzakgroup.com</p>
            </div>
          )}

          {activeLegalPanel === 'returns' && (
            <div className="auth-legal-content">
              <span className="auth-section-eyebrow">Pol&iacute;tica comercial</span>
              <h2>Pol&iacute;ticas de cambio o devoluciones</h2>
              <p>
                Al tratarse de un software basado en la nube (SaaS) con activaci&oacute;n autom&aacute;tica y entrega de valor inmediato, el usuario acepta
                las siguientes condiciones de no reembolso al momento de realizar su pago:
              </p>
              <h3>1. Pol&iacute;tica de No Reembolso (Venta Definitiva)</h3>
              <p>
                Una vez procesado el pago e ingresado al plan Pro o Corporativo, todas las transacciones son definitivas, no reembolsables y no sujetas
                a devoluci&oacute;n de dinero, independientemente de si el usuario hace uso total o parcial de la plataforma.
              </p>
              <p>No aplican devoluciones bajo ninguna circunstancia por:</p>
              <ul>
                <li>Cambio de decisi&oacute;n o desinter&eacute;s posterior del usuario.</li>
                <li>Descarga previa de reportes t&eacute;cnicos.</li>
                <li>Incompatibilidad o bloqueos t&eacute;cnicos provenientes del sitio web del propio cliente.</li>
              </ul>
              <h3>2. Excepci&oacute;n &Uacute;nica: Errores de la Pasarela de Pagos</h3>
              <p>
                La &uacute;nica excepci&oacute;n para una devoluci&oacute;n de dinero es el caso comprobable de cobros duplicados generados por la pasarela de pagos
                al procesar una misma suscripci&oacute;n. En dicha situaci&oacute;n, se reembolsar&aacute; &uacute;nicamente el importe cobrado en exceso tras la verificaci&oacute;n t&eacute;cnica.
              </p>
              <h3>3. Canal de Reportes e Incidencias T&eacute;cnicas (Obligatoriedad de Correo)</h3>
              <p>
                Si la plataforma presenta alguna falla t&eacute;cnica, interrupci&oacute;n en el servicio o los accesos Pro no se activan de forma inmediata por un error del sistema,
                no se gestionar&aacute;n reembolsos de dinero. En su lugar, el usuario tiene la obligaci&oacute;n de reportar la incidencia por la v&iacute;a oficial para su soluci&oacute;n:
              </p>
              <ul>
                <li><strong>Correo de soporte:</strong> El usuario deber&aacute; enviar un correo electr&oacute;nico a administrador@gzakgroup.com detallando el problema.</li>
                <li><strong>Informaci&oacute;n requerida:</strong> Se debe adjuntar el comprobante de pago, el ID de usuario y una captura o descripci&oacute;n del error t&eacute;cnico.</li>
                <li><strong>Compromiso de soluci&oacute;n:</strong> El caso ser&aacute; revisado dentro de un plazo m&aacute;ximo de siete (7) d&iacute;as h&aacute;biles para corregir el acceso, solucionar la incidencia t&eacute;cnica en la plataforma o, de ser necesario, asignar d&iacute;as de cr&eacute;dito de servicio compensatorio en la cuenta del usuario.</li>
              </ul>
            </div>
          )}

          {activeLegalPanel === 'complaints' && (
            <div className="auth-legal-content">
              <span className="auth-section-eyebrow">Atenci&oacute;n al consumidor</span>
              <h2>Libro de Reclamaciones</h2>
              <p>
                Conforme a la normativa peruana de protecci&oacute;n al consumidor, ponemos a disposici&oacute;n este Libro de Reclamaciones virtual
                para registrar reclamos o quejas sobre el servicio.
              </p>
              <form className="auth-complaint-form" onSubmit={handleComplaintSubmit}>
                <label>
                  Nombre completo
                  <input name="fullName" required />
                </label>
                <label>
                  Documento de identidad
                  <input name="document" required />
                </label>
                <label>
                  Correo electr&oacute;nico
                  <input name="email" type="email" required />
                </label>
                <label>
                  Tel&eacute;fono
                  <input name="phone" required />
                </label>
                <label>
                  Tipo
                  <select name="type" required>
                    <option value="reclamo">Reclamo</option>
                    <option value="queja">Queja</option>
                  </select>
                </label>
                <label>
                  Servicio contratado
                  <input name="service" defaultValue="Sin Barreras - Plan Pro" required />
                </label>
                <label className="auth-complaint-wide">
                  Detalle del reclamo o queja
                  <textarea name="detail" rows={4} required />
                </label>
                <label className="auth-complaint-wide">
                  Pedido del consumidor
                  <textarea name="request" rows={3} required />
                </label>
                <button type="submit">Registrar reclamo</button>
              </form>
              {complaintNotice && <p className="auth-legal-success">{complaintNotice}</p>}
              {complaintError && <p className="auth-error">{complaintError}</p>}
              <p className="auth-legal-note">La respuesta ser&aacute; atendida dentro de los plazos establecidos por la normativa aplicable.</p>
            </div>
          )}
        </section>
      </div>
    )
}
    </div >
  );
}
