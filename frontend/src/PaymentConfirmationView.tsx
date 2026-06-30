import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, XCircle, RefreshCw, ShieldCheck } from 'lucide-react';

type PaymentConfirmationViewProps = {
  status: 'processing' | 'success' | 'pending' | 'failure';
  title: string;
  description: string;
  detail: string | null;
  retryPlanCode?: string;
  retryCurrency?: string;
  onBackToProjects: () => void;
  onBackToBilling: () => void;
  onRetry?: (planCode: string, currency: string) => Promise<void>;
};

export function PaymentConfirmationView({
  status,
  title,
  description,
  detail,
  retryPlanCode,
  retryCurrency,
  onBackToProjects,
  onBackToBilling,
  onRetry,
}: PaymentConfirmationViewProps) {
  const [retrying, setRetrying] = useState(false);
  const isSuccess = status === 'success';
  const isPending = status === 'pending';
  const isFailure = status === 'failure';

  const handleRetry = async () => {
    if (!onRetry || !retryPlanCode || !retryCurrency) return;
    setRetrying(true);
    try {
      await onRetry(retryPlanCode, retryCurrency);
    } finally {
      setRetrying(false);
    }
  };

  const iconBg = isSuccess ? '#ecfdf5' : isFailure ? '#fef2f2' : '#eff6ff';
  const iconColor = isSuccess ? '#0f766e' : isFailure ? '#dc2626' : '#2563eb';
  const iconShadow = isSuccess
    ? '0 14px 30px rgba(15, 118, 110, 0.14)'
    : isFailure
      ? '0 14px 30px rgba(220, 38, 38, 0.14)'
      : '0 14px 30px rgba(37, 99, 235, 0.14)';

  return (
    <section className="billing-page billing-simple-page" aria-label="Confirmacion de pago">
      <div className="billing-hero billing-compact-hero">
        <div>
          <p className="billing-eyebrow">Pago y suscripcion</p>
          <h2>{isSuccess ? 'Gracias por tu compra' : isPending ? 'Pago en revision' : isFailure ? 'Pago no completado' : 'Confirmando pago'}</h2>
          <p>{description}</p>
        </div>
        <button type="button" className="billing-back-btn" onClick={onBackToProjects}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al sistema
        </button>
      </div>

      <article className="billing-plan-card billing-plan-pro" style={{ maxWidth: 860, margin: '0 auto' }}>
        <div
          aria-hidden="true"
          style={{
            width: 72,
            height: 72,
            borderRadius: '999px',
            display: 'grid',
            placeItems: 'center',
            marginBottom: '1.5rem',
            background: iconBg,
            color: iconColor,
            boxShadow: iconShadow,
          }}
        >
          {isSuccess ? <CheckCircle2 className="h-9 w-9" /> : isFailure ? <XCircle className="h-9 w-9" /> : <Clock3 className="h-9 w-9" />}
        </div>

        <div className="billing-plan-head" style={{ marginBottom: '1rem' }}>
          <div>
            <p>Estado</p>
            <h3>{title}</h3>
          </div>
        </div>

        <p style={{ margin: 0, color: '#334155', fontSize: '1rem', lineHeight: 1.7 }}>
          {isSuccess
            ? 'Tu regreso desde Mercado Pago fue recibido correctamente y ya dejamos lista la confirmacion visual dentro del sistema.'
            : isPending
              ? 'Mercado Pago nos devolvio tu operacion, pero todavia no aparece como aprobada. Puedes revisar tu plan en unos minutos.'
              : isFailure
                ? 'No se pudo completar el pago. Puedes intentarlo nuevamente con otra tarjeta — se creara un nuevo intento desde cero.'
                : 'Estamos terminando de validar la operacion para mostrarte el estado final de tu suscripcion.'}
        </p>

        {detail && (
          <div className="billing-note" style={{ marginTop: '1.25rem' }}>
            {detail}
          </div>
        )}

        {isFailure && onRetry && retryPlanCode && retryCurrency && (
          <div
            style={{
              marginTop: '1.5rem',
              padding: '1rem 1.1rem',
              borderRadius: '18px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
            }}
          >
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <ShieldCheck className="h-5 w-5" aria-hidden="true" style={{ color: '#dc2626', marginTop: '0.1rem', flexShrink: 0 }} />
              <span style={{ color: '#7f1d1d', lineHeight: 1.6, fontSize: '0.9rem' }}>
                Mercado Pago rechaza el intento anterior — no se puede reutilizar. Al hacer clic en "Intentar nuevamente" se crea un checkout completamente nuevo para que puedas pagar con otra tarjeta.
              </span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.9rem', marginTop: '1.5rem' }}>
          {isFailure && onRetry && retryPlanCode && retryCurrency ? (
            <>
              <button
                type="button"
                className="billing-contact-btn"
                onClick={handleRetry}
                disabled={retrying}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" style={{ animation: retrying ? 'spin 1s linear infinite' : 'none' }} />
                {retrying ? 'Creando nuevo intento...' : 'Intentar nuevamente'}
              </button>
              <button type="button" className="billing-outline-btn" onClick={onBackToBilling}>
                Ver planes
              </button>
            </>
          ) : (
            <>
              <button type="button" className="billing-contact-btn" onClick={onBackToProjects}>
                Ir a mis proyectos
              </button>
              <button type="button" className="billing-outline-btn" onClick={onBackToBilling}>
                Ver mi plan
              </button>
            </>
          )}
        </div>
      </article>
    </section>
  );
}
