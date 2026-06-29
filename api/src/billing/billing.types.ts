export type BillingProvider = 'mercadopago';
export type BillingCurrency = 'PEN' | 'USD';
export type BillingPlanCode = 'monthly' | 'annual';
export type BillingStatus = 'inactive' | 'pending' | 'active' | 'past_due' | 'canceled';

export interface BillingPlanConfig {
  code: BillingPlanCode;
  currency: BillingCurrency;
  label: string;
  description: string;
  amountEnv: string;
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

export const BILLING_PROVIDER: BillingProvider = 'mercadopago';

export const BILLING_PLAN_CONFIGS: BillingPlanConfig[] = [
  {
    code: 'monthly',
    currency: 'PEN',
    label: 'Mensual',
    description: 'Suscripción recurrente mensual en soles.',
    amountEnv: 'MP_MONTHLY_PEN_AMOUNT',
  },
  {
    code: 'annual',
    currency: 'PEN',
    label: 'Anual',
    description: 'Suscripción recurrente anual en soles.',
    amountEnv: 'MP_ANNUAL_PEN_AMOUNT',
  },
  {
    code: 'monthly',
    currency: 'USD',
    label: 'Mensual',
    description: 'Suscripción recurrente mensual en dólares.',
    amountEnv: 'MP_MONTHLY_USD_AMOUNT',
  },
  {
    code: 'annual',
    currency: 'USD',
    label: 'Anual',
    description: 'Suscripción recurrente anual en dólares.',
    amountEnv: 'MP_ANNUAL_USD_AMOUNT',
  },
];
