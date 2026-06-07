export type BillingProvider = 'culqi';
export type BillingCurrency = 'PEN' | 'USD';
export type BillingPlanCode = 'monthly' | 'annual';
export type BillingStatus = 'inactive' | 'pending' | 'active' | 'past_due' | 'canceled';

export interface BillingPlanConfig {
  code: BillingPlanCode;
  currency: BillingCurrency;
  label: string;
  description: string;
  providerPlanIdEnv: string;
  amountEnv: string;
}

export interface BillingPlan extends BillingPlanConfig {
  providerPlanId: string | null;
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
}

export const BILLING_PROVIDER: BillingProvider = 'culqi';

export const BILLING_PLAN_CONFIGS: BillingPlanConfig[] = [
  {
    code: 'monthly',
    currency: 'PEN',
    label: 'Mensual',
    description: 'Suscripción recurrente mensual en soles.',
    providerPlanIdEnv: 'CULQI_MONTHLY_PEN_PLAN_ID',
    amountEnv: 'CULQI_MONTHLY_PEN_AMOUNT',
  },
  {
    code: 'annual',
    currency: 'PEN',
    label: 'Anual',
    description: 'Suscripción recurrente anual en soles.',
    providerPlanIdEnv: 'CULQI_ANNUAL_PEN_PLAN_ID',
    amountEnv: 'CULQI_ANNUAL_PEN_AMOUNT',
  },
  {
    code: 'monthly',
    currency: 'USD',
    label: 'Mensual',
    description: 'Suscripción recurrente mensual en dólares.',
    providerPlanIdEnv: 'CULQI_MONTHLY_USD_PLAN_ID',
    amountEnv: 'CULQI_MONTHLY_USD_AMOUNT',
  },
  {
    code: 'annual',
    currency: 'USD',
    label: 'Anual',
    description: 'Suscripción recurrente anual en dólares.',
    providerPlanIdEnv: 'CULQI_ANNUAL_USD_PLAN_ID',
    amountEnv: 'CULQI_ANNUAL_USD_AMOUNT',
  },
];
