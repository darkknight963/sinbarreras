import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { BillingPlan } from './billing';

declare global {
  interface Window {
    Culqi?: {
      publicKey: string;
      settings: (settings: Record<string, unknown>) => void;
      open: () => void;
      close: () => void;
      token?: { id: string; email: string };
      error?: Record<string, unknown>;
    };
    culqiSettings?: unknown;
    culqi?: () => void;
  }
}

type Props = {
  plan: BillingPlan;
  userEmail: string;
  onToken: (token: string) => Promise<void>;
  onClose: () => void;
};

const CULQI_PUBLIC_KEY = import.meta.env.VITE_CULQI_PUBLIC_KEY || 'pk_live_9soMfgQwzum5vP8X';

export function CulqiCheckoutModal({ plan, userEmail, onToken, onClose }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'processing' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const culqiReadyRef = useRef(false);

  const amountCentavos = plan.amount ?? 0;
  const displayAmount = (amountCentavos / 100).toFixed(2);

  useEffect(() => {
    // Inject Culqi.js once
    if (!document.getElementById('culqi-js')) {
      const script = document.createElement('script');
      script.id = 'culqi-js';
      script.src = 'https://js.culqi.com/checkout-js';
      script.async = true;
      document.head.appendChild(script);
    }

    // Poll until Culqi object is available
    const poll = setInterval(() => {
      if (window.Culqi) {
        clearInterval(poll);
        culqiReadyRef.current = true;
        initCulqi();
      }
    }, 100);

    const maxWait = setTimeout(() => {
      clearInterval(poll);
      if (!culqiReadyRef.current) {
        setStatus('error');
        setErrorMsg('No se pudo cargar el módulo de pago. Verifica tu conexión e intenta de nuevo.');
      }
    }, 8000);

    return () => {
      clearInterval(poll);
      clearTimeout(maxWait);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function initCulqi() {
    if (!window.Culqi) return;

    window.Culqi.publicKey = CULQI_PUBLIC_KEY;
    window.Culqi.settings({
      title: 'Sin Barreras',
      currency: 'PEN',
      description: plan.label,
      amount: amountCentavos,
      order: '',
    });

    // Culqi calls window.culqi() when user submits card or closes
    window.culqi = async () => {
      if (window.Culqi?.token) {
        const token = window.Culqi.token.id;
        setStatus('processing');
        setErrorMsg(null);
        try {
          await onToken(token);
        } catch (err) {
          setStatus('error');
          setErrorMsg(err instanceof Error ? err.message : 'Error al procesar el pago. Intenta de nuevo.');
        }
      } else if (window.Culqi?.error) {
        const culqiErr = window.Culqi.error as Record<string, unknown>;
        const msg = String(culqiErr.user_message || culqiErr.merchant_message || 'Error al leer la tarjeta');
        setStatus('error');
        setErrorMsg(msg);
      }
    };

    setStatus('idle');
  }

  const handleOpenCulqi = () => {
    if (!culqiReadyRef.current || !window.Culqi) {
      setStatus('error');
      setErrorMsg('El módulo de pago aún no está listo. Espera un momento e intenta de nuevo.');
      return;
    }
    setErrorMsg(null);
    window.Culqi.open();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#fff', borderRadius: 16, padding: '2rem',
          width: '100%', maxWidth: 420, position: 'relative',
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#94a3b8', padding: 4,
          }}
        >
          <X className="h-5 w-5" />
        </button>

        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.25rem', color: '#0f172a' }}>
          Activar Plan Pro
        </h2>
        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1.5rem' }}>
          S/ {displayAmount}/mes &nbsp;·&nbsp; Mensual
        </p>

        <div style={{
          background: '#f8fafc', borderRadius: 10, padding: '1rem',
          marginBottom: '1.5rem', fontSize: '0.85rem', color: '#475569',
          lineHeight: 1.6,
        }}>
          <strong style={{ color: '#0f172a' }}>Cuenta:</strong> {userEmail}<br />
          <strong style={{ color: '#0f172a' }}>Plan:</strong> {plan.label} en Soles<br />
          <strong style={{ color: '#0f172a' }}>Pago:</strong> Tarjeta de crédito o débito (Culqi)
        </div>

        {errorMsg && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5',
            borderRadius: 8, padding: '0.75rem 1rem',
            color: '#b91c1c', fontSize: '0.85rem', marginBottom: '1rem',
          }}>
            {errorMsg}
          </div>
        )}

        {status === 'processing' ? (
          <div style={{ textAlign: 'center', padding: '1rem', color: '#2563eb', fontWeight: 600 }}>
            Procesando suscripción...
          </div>
        ) : (
          <button
            type="button"
            onClick={handleOpenCulqi}
            disabled={status === 'loading'}
            style={{
              width: '100%', padding: '0.85rem',
              background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: 10,
              fontSize: '1rem', fontWeight: 700,
              cursor: status === 'loading' ? 'wait' : 'pointer',
              opacity: status === 'loading' ? 0.7 : 1,
            }}
          >
            {status === 'loading' ? 'Cargando...' : `Pagar S/ ${displayAmount}`}
          </button>
        )}

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', marginTop: '1rem' }}>
          Pago seguro procesado por Culqi &nbsp;·&nbsp; Cancela cuando quieras
        </p>
      </div>
    </div>
  );
}
