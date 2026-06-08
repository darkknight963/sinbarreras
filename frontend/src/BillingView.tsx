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

const mailTo = (subject: string) =>
  `mailto:ventas@sinbarreras.pe?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    'Hola, quiero cotizar una suscripcion para Sin Barreras.',
  )}`;

const formatAmount = (plan: BillingPlan | undefined) => {
  if (!plan?.amount) return 'Pr\u00f3ximamente';
  const symbol = plan.currency === 'PEN' ? 'S/' : '$';
  return `${symbol} ${plan.amount}`;
};

const formatMonthlyDisplayAmount = (plan: BillingPlan | undefined) => {
  if (!plan?.amount) return 'Pr\u00f3ximamente';
  const symbol = plan.currency === 'PEN' ? 'S/' : '$';
  const amount = plan.code === 'annual' ? Math.round(plan.amount / 12) : plan.amount;
  return `${symbol} ${amount}`;
};

const formatBeforeAmount = (plan: BillingPlan | undefined) => {
  if (!plan?.amount) return null;
  const symbol = plan.currency === 'PEN' ? 'S/' : '$';
  return `${symbol}${Math.round(plan.amount / 0.8)}`;
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
const pill = (value: string, tone: 'neutral' | 'accent' | 'info' = 'neutral'): CompareCell => ({
  kind: 'pill',
  value,
  tone,
});

const comparisonRows: CompareRow[] = [
  { type: 'section', label: 'Escaneo' },
  { type: 'row', feature: 'Análisis por mes', free: text('Ilimitado'), pro: text('Ilimitado'), enterprise: text('Ilimitado') },
  { type: 'section', label: 'Reportes y exportación' },
  { type: 'row', feature: 'Vista de resultados en pantalla', free: mark(true), pro: mark(true), enterprise: mark(true) },
  { type: 'row', feature: 'Exportar PDF Ejecutivo', free: mark(false), pro: mark(true), enterprise: mark(true) },
  { type: 'row', feature: 'Exportar PDF técnico', free: mark(false), pro: mark(true), enterprise: mark(true) },
  { type: 'row', feature: 'Exportar Excel', free: mark(false), pro: mark(true), enterprise: mark(true) },
  { type: 'row', feature: 'Historial de reportes', free: text('1'), pro: text('Ilimitado'), enterprise: text('Ilimitado') },
  { type: 'section', label: 'Remediación' },
  { type: 'row', feature: 'Descripción del error + criterio WCAG', free: mark(true), pro: mark(true), enterprise: mark(true) },
  { type: 'row', feature: 'Pasos de remediación por error', free: mark(false), pro: mark(true), enterprise: mark(true) },
  { type: 'row', feature: 'Sugerencias de código corregido', free: mark(false), pro: mark(true), enterprise: mark(true) },
  { type: 'row', feature: 'Priorización por severidad', free: pill('Limitado'), pro: mark(true), enterprise: mark(true) },
  { type: 'section', label: 'Cumplimiento legal' },
  { type: 'row', feature: 'Mapeo a WCAG 2.2', free: pill('Básico'), pro: mark(true), enterprise: mark(true) },
  { type: 'row', feature: 'Mapeo a Ley N° 29973 (Perú)', free: mark(false), pro: mark(true), enterprise: mark(true) },
  { type: 'row', feature: 'Declaración de accesibilidad', free: mark(false), pro: mark(true), enterprise: mark(true) },
  { type: 'row', feature: 'Certificado de cumplimiento descargable', free: mark(false), pro: mark(false), enterprise: mark(true) },
  { type: 'section', label: 'Gestión y equipo' },
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
  const [billingPeriod, setBillingPeriod] = useState<BillingPlanCode>('monthly');
  const currencyPlans = plans.filter((plan) => plan.currency === billingCurrency);
  const availablePlans = currencyPlans.filter((plan) => plan.available);
  const unavailablePlans = currencyPlans.filter((plan) => !plan.available);
  const hasPlansForCurrency = currencyPlans.length > 0;
  const selectedPlan = useMemo(
    () => currencyPlans.find((plan) => plan.code === billingPeriod) || availablePlans[0] || currencyPlans[0],
    [availablePlans, billingPeriod, currencyPlans],
  );
  const annualPlan = currencyPlans.find((plan) => plan.code === 'annual');
  const activeSelectedPlan = Boolean(
    selectedPlan &&
    billingState?.plan === selectedPlan.code &&
    billingState?.currency === selectedPlan.currency,
  );
  const selectedPlanKey = selectedPlan ? `${selectedPlan.code}:${selectedPlan.currency}` : '';
  const selectedPlanUnavailable = !selectedPlan || (!selectedPlan.available && !hasExternalProPaymentLink);
  const proButtonLabel = submittingKey === selectedPlanKey
    ? 'Abriendo Culqi...'
    : activeSelectedPlan
      ? 'Plan activo'
      : selectedPlanUnavailable
        ? 'Empezar con Pro'
        : 'Empezar con Pro';
  const beforeAnnualAmount = formatBeforeAmount(annualPlan);
  const isAnnual = billingPeriod === 'annual';
  const proDisplayPrice = selectedPlan?.amount ? formatMonthlyDisplayAmount(selectedPlan) : isAnnual ? 'S/ 79' : 'S/ 99';
  const proAnnualNote = isAnnual
    ? annualPlan?.amount
      ? `${formatAmount(annualPlan)} facturado anualmente${beforeAnnualAmount ? ` - antes ${beforeAnnualAmount}` : ''}`
      : 'S/ 948 facturado anualmente'
    : null;
  const enterprisePrice = 'S/ 249';
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

      <div className="billing-toolbar billing-period-toolbar">
        <button
          type="button"
          onClick={() => setBillingPeriod('monthly')}
          className={!isAnnual ? 'billing-period-label-active' : ''}
        >
          Mensual
        </button>
        <button
          type="button"
          className={`billing-toggle-track ${isAnnual ? 'billing-toggle-track-active' : ''}`}
          aria-label="Cambiar facturaci&oacute;n mensual o anual"
          aria-pressed={isAnnual}
          onClick={() => setBillingPeriod(isAnnual ? 'monthly' : 'annual')}
        >
          <span />
        </button>
        <button
          type="button"
          onClick={() => setBillingPeriod('annual')}
          className={isAnnual ? 'billing-period-label-active' : ''}
        >
          Anual
        </button>
        <span className="billing-save-pill">Ahorra 20%</span>
      </div>

      {!loading && !hasPlansForCurrency && (
        <div className="billing-warning">
          {unavailablePlans.length > 0
            ? 'Hay planes configurados para esta moneda, pero Culqi aun no devolvio un monto o id valido.'
            : 'No hay planes configurados para esta moneda. Revisa las variables de Culqi del backend.'}
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
            <div className={`billing-price-row ${selectedPlanUnavailable ? 'billing-price-unavailable' : ''}`}>
              <strong>{proDisplayPrice}</strong>
            </div>
            <p className="billing-price-note">por mes</p>
            {proAnnualNote && <p className="billing-price-note">{proAnnualNote}</p>}
            <ul className="billing-feature-list">
              <li><CheckCircle className="h-4 w-4" />An&aacute;lisis ilimitados</li>
              <li><CheckCircle className="h-4 w-4" />Hasta 500 p&aacute;ginas</li>
              <li><CheckCircle className="h-4 w-4" />Exportar PDF y Excel</li>
              <li><CheckCircle className="h-4 w-4" />Pasos de remediaci&oacute;n</li>
              <li><CheckCircle className="h-4 w-4" />Mapeo Ley N&deg; 29973</li>
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

          <article className="billing-plan-card billing-plan-enterprise">
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
            <a href={mailTo('Cotizacion Enterprise - Sin Barreras')} className="billing-outline-btn">
              Contactar ventas
            </a>
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
                <small>S/ 99/mes</small>
                <em>Popular</em>
              </th>
              <th>
                <span>Empresa</span>
                <small>S/ 249/mes</small>
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
                  <td>{renderCompareCell(row.enterprise)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
