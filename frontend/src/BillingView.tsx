import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle,
  X,
} from 'lucide-react';
import type { BillingCurrency, BillingPlan, BillingPlanCode, BillingState } from './billing';

type BillingViewProps = {
  plans: BillingPlan[];
  billingState: BillingState | null;
  billingCurrency: BillingCurrency;
  loading: boolean;
  submittingKey: string | null;
  note: string | null;
  hasExternalProPaymentLink: boolean;
  onChangeCurrency: (currency: BillingCurrency) => void;
  onSubscribe: (plan: BillingPlan) => void;
  onReload: () => void;
  onBack: () => void;
};


type CompareCell =
  | { kind: 'mark'; value: boolean }
  | { kind: 'text'; value: string }
  | { kind: 'pill'; value: string; tone?: 'neutral' | 'accent' | 'info' };

type CompareRow =
  | { type: 'section'; label: string }
  | { type: 'row'; feature: string; free: CompareCell; pro: CompareCell; enterprise: CompareCell };

const mark = (value: boolean): CompareCell => ({ kind: 'mark', value });
const text = (value: string): CompareCell => ({ kind: 'text', value });

const comparisonRows: CompareRow[] = [
  { type: 'section', label: 'Escaneo' },
  { type: 'row', feature: 'Análisis por mes', free: text('Ilimitado'), pro: text('Ilimitado'), enterprise: text('Ilimitado') },
  { type: 'section', label: 'Reportes y exportación' },
  { type: 'row', feature: 'Vista de resultados en pantalla', free: text('Limitado'), pro: mark(true), enterprise: mark(true) },
  { type: 'row', feature: 'Exportar PDF ejecutivo', free: mark(false), pro: mark(true), enterprise: mark(true) },
  { type: 'row', feature: 'Exportar PDF técnico', free: mark(false), pro: mark(true), enterprise: mark(true) },
  { type: 'row', feature: 'Exportar matriz Excel', free: mark(false), pro: mark(true), enterprise: mark(true) },
  { type: 'row', feature: 'Historial de reportes', free: text('1'), pro: text('10'), enterprise: text('Ilimitado') },
  { type: 'section', label: 'Remediación' },
  { type: 'row', feature: 'Descripción del error + criterio WCAG', free: mark(false), pro: mark(true), enterprise: mark(true) },
  { type: 'row', feature: 'Pasos de remediación por error', free: mark(false), pro: mark(true), enterprise: mark(true) },
  { type: 'row', feature: 'Sugerencias de código corregido', free: mark(false), pro: mark(true), enterprise: mark(true) },
  { type: 'row', feature: 'Priorización por severidad', free: mark(false), pro: mark(true), enterprise: mark(true) },
  { type: 'section', label: 'Cumplimiento legal' },
  { type: 'row', feature: 'Mapeo a WCAG', free: mark(true), pro: mark(true), enterprise: mark(true) },
  { type: 'row', feature: 'Mapeo a Ley N° 29973 (Perú)', free: mark(false), pro: mark(true), enterprise: mark(true) },
  { type: 'row', feature: 'Declaración de accesibilidad', free: mark(false), pro: mark(true), enterprise: mark(true) },
  { type: 'row', feature: 'Certificado de cumplimiento descargable', free: mark(false), pro: mark(false), enterprise: mark(true) },
  { type: 'section', label: 'Gestión y equipo' },
  { type: 'row', feature: 'Creación de proyectos', free: mark(false), pro: mark(true), enterprise: mark(true) },
  { type: 'row', feature: 'Proyectos activos', free: mark(false), pro: text('10 proyectos'), enterprise: text('Hasta 50 proyectos') },
  { type: 'row', feature: 'Usuarios', free: text('1'), pro: text('1'), enterprise: text('Hasta 10') },
  { type: 'row', feature: 'Panel de gestión de hallazgos', free: mark(false), pro: mark(true), enterprise: mark(true) },
];

const renderCompareCell = (cell: CompareCell) => {
  if (cell.kind === 'mark') {
    return (
      <span className={`billing-compare-mark ${cell.value ? 'billing-compare-mark-on' : 'billing-compare-mark-off'}`}>
        {cell.value ? 'Sí' : 'No'}
      </span>
    );
  }

  if (cell.kind === 'pill') {
    return <span className={`billing-compare-pill billing-compare-pill-${cell.tone || 'neutral'}`}>{cell.value}</span>;
  }

  return <span>{cell.value}</span>;
};

export function BillingView({
  plans,
  billingState,
  billingCurrency,
  loading,
  submittingKey,
  note,
  hasExternalProPaymentLink,
  onBack,
  onSubscribe,
}: BillingViewProps) {
  const [billingPeriod] = useState<BillingPlanCode>('monthly');
  const currencyPlans = plans.filter((plan) => plan.currency === billingCurrency);
  const availablePlans = currencyPlans.filter((plan) => plan.available);
  const unavailablePlans = currencyPlans.filter((plan) => !plan.available);
  const hasPlansForCurrency = currencyPlans.length > 0;
  const selectedPlan = useMemo(
    () => currencyPlans.find((plan) => plan.code === billingPeriod) || availablePlans[0] || currencyPlans[0],
    [availablePlans, billingPeriod, currencyPlans],
  );

  const activeSelectedPlan = Boolean(
    selectedPlan &&
    billingState?.plan === selectedPlan.code &&
    billingState?.currency === selectedPlan.currency,
  );
  const selectedPlanKey = selectedPlan ? `${selectedPlan.code}:${selectedPlan.currency}` : '';
  const selectedPlanUnavailable = !selectedPlan || (!selectedPlan.available && !hasExternalProPaymentLink);
  const proButtonLabel = submittingKey === selectedPlanKey
    ? 'Procesando...'
    : activeSelectedPlan
      ? 'Plan activo'
      : selectedPlanUnavailable
        ? 'Empezar con Pro'
        : 'Empezar con Pro';
  const enterprisePrice = '-';
  const enterpriseBillingNote = null;

  return (
    <section className="billing-page billing-simple-page" aria-label="Planes y tarifas">
      <div className="billing-hero billing-compact-hero">
        <div>
          <p className="billing-eyebrow">Precios</p>
          <h2>Simple y transparente</h2>
          <p>Sin sorpresas. Cancela cuando quieras.</p>
        </div>
        <button type="button" className="billing-back-btn" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al sistema
        </button>
      </div>

      <div className="billing-toolbar billing-period-toolbar" style={{ justifyContent: 'center' }}>
        <button
          type="button"
          disabled
          className="billing-period-label-active"
          style={{ cursor: 'default' }}
        >
          Mensual
        </button>
      </div>

      {!loading && !hasPlansForCurrency && (
        <div className="billing-warning">
          {unavailablePlans.length > 0
            ? 'Hay planes configurados para esta moneda, pero aún no se configuró un monto válido.'
            : 'No hay planes configurados para esta moneda. Revisa las variables de entorno del backend.'}
        </div>
      )}

      {note && <div className="billing-note">{note}</div>}

      {loading ? (
        <div className="billing-loading">Cargando planes y estado de pago...</div>
      ) : (
        <div className="billing-plan-grid billing-pricing-grid">
          <article className="billing-plan-card billing-plan-free">
            <div className="billing-plan-head">
              <div>
                <p>Gratis</p>
              </div>
            </div>
            <div className="billing-price-row">
              <strong>S/ 0</strong>
            </div>
            <p className="billing-price-note">para siempre</p>
            <ul className="billing-feature-list">
              <li><CheckCircle className="h-4 w-4" />3 an&aacute;lisis por mes</li>
              <li><CheckCircle className="h-4 w-4" />1 p&aacute;gina por an&aacute;lisis</li>
              <li><CheckCircle className="h-4 w-4" />Vista en pantalla</li>
              <li className="billing-feature-muted"><X className="h-4 w-4" />Sin exportar PDF ni Excel</li>
              <li className="billing-feature-muted"><X className="h-4 w-4" />Sin remediaci&oacute;n</li>
            </ul>
            <button type="button" disabled className="billing-disabled-btn">Empezar gratis</button>
          </article>

          <article className="billing-plan-card billing-plan-pro">
            <span className="billing-popular-badge">M&aacute;s popular</span>
            <div className="billing-plan-head">
              <div>
                <p>Pro</p>
                <h3>Pro</h3>
              </div>
            </div>
            <div className={`billing-price-row ${selectedPlanUnavailable ? 'billing-price-unavailable' : ''}`} style={{ alignItems: 'baseline', gap: '0.5rem' }}>
              <strong>S/ 79/mes</strong>
              <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#ef4444' }}>por tiempo limitado</span>
            </div>
            <p className="billing-price-note" style={{ textDecoration: 'line-through' }}>Antes S/ 199/mes</p>
            <ul className="billing-feature-list">
              <li><CheckCircle className="h-4 w-4" />An&aacute;lisis ilimitados</li>
              <li><CheckCircle className="h-4 w-4" />Exportar PDF ejecutivo y t&eacute;cnico</li>
              <li><CheckCircle className="h-4 w-4" />Exportar matriz Excel</li>
              <li><CheckCircle className="h-4 w-4" />Pasos de remediaci&oacute;n</li>
              <li><CheckCircle className="h-4 w-4" />Creaci&oacute;n de proyectos</li>
            </ul>
            <button
              type="button"
              disabled={selectedPlanUnavailable || loading || Boolean(submittingKey)}
              onClick={() => selectedPlan && onSubscribe(selectedPlan)}
              className="billing-contact-btn"
            >
              {proButtonLabel}
              {!activeSelectedPlan && !selectedPlanUnavailable && <ArrowUpRight className="h-4 w-4" aria-hidden="true" />}
            </button>
          </article>

          <article className="billing-plan-card billing-plan-enterprise billing-plan-coming-soon" aria-label="Plan Empresa próximamente">
            <span className="billing-coming-soon-badge">Pr&oacute;ximamente</span>
            <div className="billing-plan-coming-soon-content">
              <div className="billing-plan-head">
                <div>
                  <p>Empresa</p>
                </div>
              </div>
              <div className="billing-price-row">
                <strong>{enterprisePrice}</strong>
              </div>
              <p className="billing-price-note">por mes</p>
              {enterpriseBillingNote && <p className="billing-price-note">{enterpriseBillingNote}</p>}
              <ul className="billing-feature-list">
                <li><CheckCircle className="h-4 w-4" />Todo lo de Pro</li>
                <li><CheckCircle className="h-4 w-4" />Hasta 10 usuarios</li>
                <li><CheckCircle className="h-4 w-4" />Reportes white-label</li>
                <li><CheckCircle className="h-4 w-4" />Monitoreo semanal</li>
                <li><CheckCircle className="h-4 w-4" />Certificado de cumplimiento</li>
              </ul>
              <button type="button" className="billing-outline-btn" disabled>
                Contactar ventas
              </button>
            </div>
          </article>
        </div>
      )}

      <div className="billing-compare-divider">
        <span>Comparativa detallada de planes</span>
      </div>

      <div className="billing-compare-wrap">
        <table className="billing-compare-table">
          <thead>
            <tr>
              <th>Caracter&iacute;stica</th>
              <th>
                <span>Gratis</span>
                <small>S/ 0</small>
              </th>
              <th className="billing-compare-pro">
                <span>Pro</span>
                <small>S/ 79/mes</small>
                <em>Popular</em>
              </th>
              <th className="billing-compare-enterprise">
                <span>Empresa</span>
                <small>Pr&oacute;ximamente</small>
              </th>
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row, index) => {
              if (row.type === 'section') {
                return (
                  <tr key={`${row.label}-${index}`} className="billing-compare-section-row">
                    <td colSpan={4}>{row.label}</td>
                  </tr>
                );
              }

              return (
                <tr key={row.feature}>
                  <td>{row.feature}</td>
                  <td>{renderCompareCell(row.free)}</td>
                  <td className="billing-compare-pro">{renderCompareCell(row.pro)}</td>
                  <td className="billing-compare-enterprise">{renderCompareCell(row.enterprise)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
