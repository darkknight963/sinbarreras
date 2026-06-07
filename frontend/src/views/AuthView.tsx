import React, { useState } from 'react';
import {
  ArrowUpRight,
  Cog,
  EyeOff,
  FileCheck2,
  Globe2,
  Landmark,
  Lock,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';

interface AuthViewProps {
  authFormMode: 'login' | 'register';
  onToggleMode: () => void;
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
  appError: string | null;
  useDemoCredentials: () => void;
}

export function AuthView({
  authFormMode,
  onToggleMode,
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
  appError,
  useDemoCredentials,
}: AuthViewProps) {
  const [showAccessPanel, setShowAccessPanel] = useState(false);

  const openAccessPanel = () => setShowAccessPanel(true);
  const closeAccessPanel = () => setShowAccessPanel(false);
  const handleStartGuest = () => onStartGuest();

  return (
    <div className="auth-landing min-h-screen">
      <header className="auth-landing-nav">
        <a className="auth-landing-brand" href="#top" aria-label="Sin Barreras inicio">
          <span className="auth-landing-logo" aria-hidden="true">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span>Sin Barreras</span>
        </a>
        <nav aria-label="Principal">
          <a href="#how-it-works">C&oacute;mo funciona</a>
          <a href="#normative-coverage">Cobertura normativa</a>
          <button type="button" onClick={onViewPlans} disabled={guestSubmitting}>Planes</button>
          <button type="button" onClick={openAccessPanel}>Iniciar sesi&oacute;n</button>
          <button type="button" className="auth-nav-primary" onClick={handleStartGuest} disabled={guestSubmitting}>
            {guestSubmitting ? 'Preparando...' : 'Empezar gratis'}
          </button>
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
                  <p>Resultados agrupados por problema &middot; WCAG 2.0 o superior</p>
                </div>
                <div className="auth-report-preview-badges" aria-label="Resumen de hallazgos">
                  <span className="auth-preview-badge auth-preview-badge-error">18 errores</span>
                  <span className="auth-preview-badge auth-preview-badge-review">19 revisiones</span>
                  <span className="auth-preview-badge auth-preview-badge-elements">138 elementos</span>
                </div>
              </div>

              <div className="auth-report-preview-metrics" aria-label="Metricas del reporte">
                <div><span>Total</span><strong>86</strong></div>
                <div><span>Aplican</span><strong>55</strong></div>
                <div><span>Cumplen</span><strong className="auth-preview-good">43</strong></div>
                <div><span>Fallan</span><strong className="auth-preview-bad">8</strong></div>
                <div><span>Revision</span><strong className="auth-preview-warn">4</strong></div>
              </div>

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

              <div className="auth-report-preview-section-title">Criterios WCAG y hallazgos</div>
              <div className="auth-report-preview-table-wrap">
                <table className="auth-report-preview-table">
                  <thead>
                    <tr>
                      <th>Criterio</th>
                      <th>Nivel</th>
                      <th>Aplicabilidad</th>
                      <th>Nombre</th>
                      <th>Hallazgos</th>
                      <th>Severidad</th>
                      <th>Estado</th>
                      <th>Solucion sugerida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['1.1.1', 'A', 'Aplica', 'Contenido no textual', '1 hallazgo', 'Medio', 'Requiere revision', 'Agregar texto alternativo descriptivo.'],
                      ['1.3.1', 'A', 'Aplica', 'Campo sin etiqueta', '1 hallazgo', 'Alto', 'Falla', 'Asociar label visible o aria-label al campo.'],
                      ['1.4.3', 'AA', 'Aplica', 'Contraste de color', '5 hallazgos', 'Alto', 'Falla', 'Ajustar colores hasta cumplir contraste minimo.'],
                      ['1.2.1', 'A', 'No aplica', 'Solo audio/video pregrabado', '-', '-', '-', '-'],
                    ].map(([criterion, level, applies, name, findings, severity, status, solution]) => (
                      <tr key={criterion}>
                        <td>{criterion}</td>
                        <td>{level}</td>
                        <td><span className={`auth-preview-pill ${applies === 'Aplica' ? '' : 'auth-preview-pill-muted'}`}>{applies}</span></td>
                        <td>{name}</td>
                        <td>{findings !== '-' ? <span className="auth-preview-pill auth-preview-pill-error">{findings}</span> : findings}</td>
                        <td>{severity}</td>
                        <td>{status !== '-' ? <span className={`auth-preview-pill ${status === 'Falla' ? 'auth-preview-pill-error' : 'auth-preview-pill-review'}`}>{status}</span> : status}</td>
                        <td>{solution}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

        <section id="how-it-works" className="auth-how-section">
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
                <strong>ISO/IEC 40500</strong>
                <p>
                  Equivalente internacional de WCAG 2.0. Criterio de calidad reconocido en auditor&iacute;as corporativas.
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

          <div className="auth-process-heading">
            <span className="auth-section-eyebrow">C&oacute;mo funciona</span>
            <h2>De la URL al reporte en segundos</h2>
            <p>Sin instalar nada. Sin configurar nada. Solo pega tu URL.</p>
          </div>

          <div className="auth-flow-timeline" aria-label="Flujo de auditoria">
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
          </div>
        </section>

        <section className="auth-final-cta" aria-label="Comenzar analisis">
          <h2>Analiza tu sitio ahora - es gratis</h2>
          <button type="button" onClick={handleStartGuest} disabled={guestSubmitting}>
            {guestSubmitting ? 'Preparando...' : 'Empezar gratis'}
          </button>
        </section>

        {showAccessPanel && (
          <div className="auth-access-modal-overlay" role="presentation" onClick={closeAccessPanel}>
            <section
              id="auth-access-panel"
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

                <button type="button" className="auth-google-button">
                  <span className="auth-google-mark" aria-hidden="true">G</span>
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
                      type="password"
                      required
                      minLength={8}
                      autoComplete={authFormMode === 'register' ? 'new-password' : 'current-password'}
                      value={authPassword}
                      onChange={(e) => onPasswordChange(e.target.value)}
                      className="auth-input auth-input-password"
                      placeholder="********"
                    />
                    <EyeOff className="auth-input-icon" aria-hidden="true" />
                  </div>
                </label>

                {authFormMode === 'register' && (
                  <div className="auth-field-grid">
                    <label className="auth-field grid gap-2">
                      <span className="auth-field-label">Nombre completo</span>
                      <input
                        type="text"
                        autoComplete="name"
                        value={authFullName}
                        onChange={(e) => onFullNameChange(e.target.value)}
                        className="auth-input"
                        placeholder="Tu nombre"
                      />
                    </label>
                    <label className="auth-field grid gap-2">
                      <span className="auth-field-label">Empresa</span>
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
                    {authFormMode === 'register' ? '\u00bfYa tienes cuenta?' : '\u00bfNo tienes cuenta?'}
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
          <a href="#privacidad">Privacidad</a>
          <a href="#terminos">T&eacute;rminos</a>
          <a href="#contacto">Contacto</a>
        </nav>
        <span>&copy; 2026 Sin Barreras &middot; Lima, Per&uacute;</span>
      </footer>
    </div>
  );
}
