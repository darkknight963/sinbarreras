import { BillingService } from './billing.service';

describe('BillingService', () => {
  const userRepository = {
    findOne: jest.fn(),
    save: jest.fn(async (value: any) => value),
    update: jest.fn(async () => ({})),
  } as any;

  const subscriptionRepository = {
    create: jest.fn((value: any) => value),
    findOne: jest.fn(),
    save: jest.fn(async (value: any) => value),
  } as any;

  const configService = {
    get: jest.fn((key: string, fallback?: string) => {
      const values: Record<string, string> = {
        CULQI_SECRET_KEY: 'sk_live_test',
        CULQI_MONTHLY_PEN_AMOUNT: '7900',
      };
      return values[key] ?? fallback ?? '';
    }),
  } as any;

  const dataSource = {
    transaction: jest.fn(async (fn: any) => fn({
      save: jest.fn(async (_entity: any, value: any) => value),
      update: jest.fn(async () => ({})),
    })),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'cliente@demo.pe',
      fullName: 'Cliente Demo',
      companyName: 'Demo SAC',
      role: 'admin',
      billingStatus: 'inactive',
      billingPlan: null,
      billingProvider: 'culqi',
      billingCurrency: null,
      billingPeriodEnd: null,
      billingCustomerId: null,
      billingSubscriptionId: null,
    });
    subscriptionRepository.findOne.mockResolvedValue(null);
    global.fetch = jest.fn() as any;
  });

  it('lists Culqi plans from env amounts', async () => {
    const service = new BillingService(userRepository, subscriptionRepository, configService, dataSource);

    await expect(service.listPlans()).resolves.toEqual([
      expect.objectContaining({ code: 'monthly', currency: 'PEN', available: true, amount: 7900, provider: 'culqi' }),
    ]);
  });

  it('requires a culqiToken to create checkout session', async () => {
    const service = new BillingService(userRepository, subscriptionRepository, configService, dataSource);

    await expect(
      service.createCheckoutSession('user-1', { planCode: 'monthly', currency: 'PEN' }),
    ).rejects.toMatchObject({ message: 'Se requiere un token de tarjeta generado por Culqi.js' });
  });

  it('creates Culqi subscription via token → customer → card → subscription', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'cus_test_123' }) })  // create customer
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'crd_test_456' }) })  // create card
      .mockResolvedValueOnce({ ok: true, json: async () => ({                           // create subscription
        id: 'sub_test_789',
        customer_id: 'cus_test_123',
        card_id: 'crd_test_456',
        plan_id: 'pln_live_zIcHlDPYFqnA9XqZ',
      }) });

    const service = new BillingService(userRepository, subscriptionRepository, configService, dataSource);

    const result = await service.createCheckoutSession('user-1', {
      planCode: 'monthly',
      currency: 'PEN',
      culqiToken: 'tkn_test_abc',
    });

    expect(result).toMatchObject({
      status: 'active',
      subscriptionId: 'sub_test_789',
    });
  });

  it('handles subscription.charge.success webhook', async () => {
    subscriptionRepository.findOne.mockResolvedValue({
      id: 'billing-sub-1',
      plan: 'monthly',
      status: 'active',
      user: { id: 'user-1' },
    });

    const service = new BillingService(userRepository, subscriptionRepository, configService, dataSource);

    await expect(
      service.handleWebhook({ type: 'subscription.charge.succeeded', data: { subscription_id: 'sub_test_789' } }),
    ).resolves.toEqual({ ok: true, matched: true });
  });

  it('handles subscription.charge.failed webhook', async () => {
    subscriptionRepository.findOne.mockResolvedValue({
      id: 'billing-sub-1',
      plan: 'monthly',
      status: 'active',
      user: { id: 'user-1' },
    });

    const service = new BillingService(userRepository, subscriptionRepository, configService, dataSource);

    await expect(
      service.handleWebhook({ type: 'subscription.charge.failed', data: { subscription_id: 'sub_test_789' } }),
    ).resolves.toEqual({ ok: true, matched: true });
  });

  it('parses webhook data sent as a JSON string', async () => {
    subscriptionRepository.findOne.mockResolvedValue({
      id: 'billing-sub-1',
      plan: 'monthly',
      status: 'active',
      user: { id: 'user-1' },
    });

    const service = new BillingService(userRepository, subscriptionRepository, configService, dataSource);

    await expect(
      service.handleWebhook({
        type: 'subscription.charge.succeeded',
        data: JSON.stringify({ subscription_id: 'sub_test_789' }),
      }),
    ).resolves.toEqual({ ok: true, matched: true });
  });

  it('extracts nested subscription.id and sxn_-prefixed ids from webhook data', async () => {
    subscriptionRepository.findOne.mockResolvedValue({
      id: 'billing-sub-1',
      plan: 'monthly',
      status: 'active',
      user: { id: 'user-1' },
    });

    const service = new BillingService(userRepository, subscriptionRepository, configService, dataSource);

    await expect(
      service.handleWebhook({
        type: 'subscription.charge.failed',
        data: { id: 'chr_live_abc123', subscription: { id: 'sxn_live_xyz' } },
      }),
    ).resolves.toEqual({ ok: true, matched: true });

    await expect(
      service.handleWebhook({
        type: 'subscription.cancel.succeeded',
        data: { id: 'sxn_live_xyz' },
      }),
    ).resolves.toEqual({ ok: true, matched: true });
  });

  it('does not treat a charge id (chr_) as a subscription id', async () => {
    subscriptionRepository.findOne.mockResolvedValue(null);
    const service = new BillingService(userRepository, subscriptionRepository, configService, dataSource);

    await expect(
      service.handleWebhook({
        type: 'subscription.charge.failed',
        data: { id: 'chr_live_only_charge_id' },
      }),
    ).resolves.toEqual({ ok: true, matched: false });
    // No debe intentar buscar con el id del cargo
    expect(subscriptionRepository.findOne).not.toHaveBeenCalled();
  });

  it('ignores unknown webhook types', async () => {
    const service = new BillingService(userRepository, subscriptionRepository, configService, dataSource);

    await expect(
      service.handleWebhook({ type: 'some.unknown.event', data: {} }),
    ).resolves.toEqual({ ok: true, ignored: true });
  });
});
