export type BillingCurrency = 'PEN' | 'USD';
export type BillingPlanCode = 'monthly' | 'annual';
export type BillingProvider = 'culqi';
export type BillingStatus = 'inactive' | 'pending' | 'active' | 'past_due' | 'canceled';

export interface BillingPlan {
  code: BillingPlanCode;
  currency: BillingCurrency;
  label: string;
  description: string;
  provider: BillingProvider;
  providerPlanId: string | null;
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

export interface CulqiCheckoutToken {
  id: string;
}

export interface CulqiCheckoutInstance {
  token: CulqiCheckoutToken | null;
  order: unknown;
  error: unknown;
  open: () => void;
  close: () => void;
  culqi: (() => void | Promise<void>) | null;
}

declare global {
  interface Window {
    CulqiCheckout?: new (publicKey: string, config: Record<string, unknown>) => CulqiCheckoutInstance;
  }
}
