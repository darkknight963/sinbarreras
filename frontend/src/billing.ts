export type BillingCurrency = 'PEN' | 'USD';
export type BillingPlanCode = 'monthly' | 'annual';
export type BillingProvider = 'culqi' | 'manual';
export type BillingStatus = 'inactive' | 'pending' | 'active' | 'past_due' | 'canceled';

export interface BillingPlan {
  code: BillingPlanCode;
  currency: BillingCurrency;
  label: string;
  description: string;
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

export interface BillingCheckoutResult {
  status: BillingStatus;
  subscriptionId?: string | null;
}
