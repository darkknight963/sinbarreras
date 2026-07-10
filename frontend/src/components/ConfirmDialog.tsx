import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type PendingConfirm = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

// Reemplazo del window.confirm() nativo (sin marca, sin foco gestionado) por
// un modal consistente con el resto del sistema. Uso: const confirm = useConfirm();
// luego `if (!(await confirm({ title, message }))) return;` — misma forma que
// window.confirm pero async, con Escape, foco inicial y estilo propio.
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    setPending((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!pending) return;
    cancelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        settle(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pending, settle]);

  const ConfirmDialogElement = pending ? (
    <div className="fixed inset-0 report-modal-overlay flex items-center justify-center p-4" role="presentation">
      <div
        className="report-modal confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <div className="confirm-dialog-header">
          <span className={`confirm-dialog-icon ${pending.danger ? 'confirm-dialog-icon-danger' : ''}`} aria-hidden="true">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <button type="button" className="report-modal-close" aria-label="Cancelar" onClick={() => settle(false)}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <h2 id="confirm-dialog-title" className="confirm-dialog-title">{pending.title}</h2>
        <p id="confirm-dialog-message" className="confirm-dialog-message">{pending.message}</p>
        <div className="confirm-dialog-actions">
          <button type="button" ref={cancelRef} className="report-ghost-btn" onClick={() => settle(false)}>
            {pending.cancelLabel || 'Cancelar'}
          </button>
          <button
            type="button"
            className={pending.danger ? 'confirm-dialog-danger-btn' : 'create-project-submit'}
            onClick={() => settle(true)}
          >
            {pending.confirmLabel || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmDialogElement };
}
