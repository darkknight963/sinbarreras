export type BillingProvider = 'culqi' | 'manual';
export type BillingCurrency = 'PEN' | 'USD';
export type BillingPlanCode = 'monthly' | 'annual';
export type BillingStatus = 'inactive' | 'pending' | 'active' | 'past_due' | 'canceled';

export interface BillingPlanConfig {
  code: BillingPlanCode;
  currency: BillingCurrency;
  label: string;
  description: string;
  amountEnv: string;
  culqiPlanId: string;
}

export interface BillingPlan extends BillingPlanConfig {
  provider: BillingProvider;
  available: boolean;
  amount: number | null;
}

export interface BillingState {
  status: BillingStatus;
  plan: BillingPlanCode | null;
  provider: BillingProvider;
  currency: BillingCurrency | null;
  currentPeriodEnd: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
}

export const BILLING_PROVIDER: BillingProvider = 'culqi';

export const BILLING_PLAN_CONFIGS: BillingPlanConfig[] = [
  {
    code: 'monthly',
    currency: 'PEN',
    label: 'Mensual',
    description: 'Suscripción recurrente mensual en soles.',
    amountEnv: 'CULQI_MONTHLY_PEN_AMOUNT',
    culqiPlanId: process.env.CULQI_PLAN_ID || 'pln_live_zIcHlDPYFqnA9XqZ',
  },
];
