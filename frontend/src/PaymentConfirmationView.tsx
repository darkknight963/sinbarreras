import { ArrowLeft, CheckCircle2, Clock3, ExternalLink, ShieldCheck } from 'lucide-react';

type PaymentConfirmationViewProps = {
  status: 'processing' | 'success' | 'pending';
  title: string;
  description: string;
  detail: string | null;
  onBackToProjects: () => void;
  onBackToBilling: () => void;
};

export function PaymentConfirmationView({
  status,
  title,
  description,
  detail,
  onBackToProjects,
  onBackToBilling,
}: PaymentConfirmationViewProps) {
  const isSuccess = status === 'success';
  const isPending = status === 'pending';

  return (
    <section className="billing-page billing-simple-page" aria-label="Confirmacion de pago">
      <div className="billing-hero billing-compact-hero">
        <div>
          <p className="billing-eyebrow">Pago y suscripcion</p>
          <h2>{isSuccess ? 'Gracias por tu compra' : isPending ? 'Pago en revision' : 'Confirmando pago'}</h2>
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
            background: isSuccess ? '#ecfdf5' : '#eff6ff',
            color: isSuccess ? '#0f766e' : '#2563eb',
            boxShadow: isSuccess ? '0 14px 30px rgba(15, 118, 110, 0.14)' : '0 14px 30px rgba(37, 99, 235, 0.14)',
          }}
        >
          {isSuccess ? <CheckCircle2 className="h-9 w-9" /> : <Clock3 className="h-9 w-9" />}
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
              : 'Estamos terminando de validar la operacion para mostrarte el estado final de tu suscripcion.'}
        </p>

        {detail && (
          <div className="billing-note" style={{ marginTop: '1.25rem' }}>
            {detail}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gap: '0.9rem',
            marginTop: '1.5rem',
            padding: '1rem 1.1rem',
            borderRadius: '18px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <ShieldCheck className="h-5 w-5" aria-hidden="true" style={{ color: '#2563eb', marginTop: '0.1rem' }} />
            <span style={{ color: '#334155', lineHeight: 1.6 }}>
              Esta pantalla sirve como comprobante visual para que el usuario sepa que la compra o suscripcion fue recibida por la plataforma.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <ExternalLink className="h-5 w-5" aria-hidden="true" style={{ color: '#2563eb', marginTop: '0.1rem' }} />
            <span style={{ color: '#334155', lineHeight: 1.6 }}>
              Puedes usar esta misma URL de retorno al configurar `back_urls` o el redirect de Mercado Pago.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.9rem', marginTop: '1.5rem' }}>
          <button type="button" className="billing-contact-btn" onClick={onBackToProjects}>
            Ir a mis proyectos
          </button>
          <button type="button" className="billing-outline-btn" onClick={onBackToBilling}>
            Ver mi plan
          </button>
        </div>
      </article>
    </section>
  );
}
