import { BillingService } from './billing.service';

describe('BillingService', () => {
  const userRepository = {
    findOne: jest.fn(),
    save: jest.fn(async (value) => value),
  } as any;

  const subscriptionRepository = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  } as any;

  const configService = {
    get: jest.fn((key: string, fallback?: string) => {
      const values: Record<string, string> = {
        CULQI_PUBLIC_KEY: 'pk_test_123',
        CULQI_SECRET_KEY: 'sk_test_123',
        CULQI_MONTHLY_PEN_PLAN_ID: 'pln_pen_monthly',
        CULQI_ANNUAL_PEN_PLAN_ID: 'pln_pen_annual',
        CULQI_MONTHLY_USD_PLAN_ID: 'pln_usd_monthly',
        CULQI_ANNUAL_USD_PLAN_ID: 'pln_usd_annual',
        CULQI_MONTHLY_PEN_AMOUNT: '4900',
        CULQI_ANNUAL_PEN_AMOUNT: '49000',
        CULQI_MONTHLY_USD_AMOUNT: '15',
        CULQI_ANNUAL_USD_AMOUNT: '150',
      };
      return values[key] ?? fallback ?? '';
    }),
  } as any;

  const culqiClient = {
    getPublicKey: jest.fn(() => 'pk_test_123'),
    createCustomer: jest.fn(async () => ({ id: 'cus_test_123' })),
    createCard: jest.fn(async () => ({ id: 'card_test_123' })),
    getPlan: jest.fn(async () => ({ amount: 4900 })),
    createSubscription: jest.fn(async () => ({
      id: 'sxn_test_123',
      status: 'active',
      next_billing_date: 1767225600,
    })),
    cancelSubscription: jest.fn(async () => ({})),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'cliente@demo.pe',
      fullName: 'Cliente Demo',
      companyName: 'Demo SAC',
      role: 'admin',
      isActive: true,
      createdAt: new Date('2026-05-31T12:00:00.000Z'),
      billingStatus: 'inactive',
      billingPlan: null,
      billingProvider: 'culqi',
      billingCurrency: null,
      billingPeriodEnd: null,
      billingCustomerId: null,
      billingSubscriptionId: null,
    });
    subscriptionRepository.findOne.mockResolvedValue(null);
  });

  const dataSource = {
    transaction: jest.fn(async (fn: any) => fn({
      save: jest.fn(async (entity: any, value: any) => value ?? entity),
      update: jest.fn(async () => ({})),
    })),
  } as any;

  it('lists the available plans for both currencies', async () => {
    const service = new BillingService(userRepository, subscriptionRepository, configService, culqiClient, dataSource);

    await expect(service.listPlans()).resolves.toEqual([
      expect.objectContaining({ code: 'monthly', currency: 'PEN', available: true }),
      expect.objectContaining({ code: 'annual', currency: 'PEN', available: true }),
      expect.objectContaining({ code: 'monthly', currency: 'USD', available: true }),
      expect.objectContaining({ code: 'annual', currency: 'USD', available: true }),
    ]);
  });

  it('supports legacy Culqi plan env names and fetches pricing when amount vars are missing', async () => {
    const legacyConfigService = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          CULQI_PUBLIC_KEY: 'pk_test_123',
          CULQI_SECRET_KEY: 'sk_test_123',
          CULQI_MONTHLY_PLAN_ID: 'pln_pen_monthly',
          CULQI_ANNUAL_PLAN_ID: 'pln_pen_annual',
        };
        return values[key] ?? fallback ?? '';
      }),
    } as any;

    const culqiFallbackClient = {
      ...culqiClient,
      getPlan: jest.fn(async (planId: string) => ({
        amount: planId.includes('monthly') ? 4900 : 49000,
      })),
    } as any;

    const service = new BillingService(
      userRepository,
      subscriptionRepository,
      legacyConfigService,
      culqiFallbackClient,
      dataSource,
    );

    await expect(service.listPlans()).resolves.toEqual([
      expect.objectContaining({ code: 'monthly', currency: 'PEN', available: true, amount: 4900 }),
      expect.objectContaining({ code: 'annual', currency: 'PEN', available: true, amount: 49000 }),
      expect.objectContaining({ code: 'monthly', currency: 'USD', available: false, amount: null }),
      expect.objectContaining({ code: 'annual', currency: 'USD', available: false, amount: null }),
    ]);

    expect(culqiFallbackClient.getPlan).toHaveBeenCalledWith('pln_pen_monthly');
    expect(culqiFallbackClient.getPlan).toHaveBeenCalledWith('pln_pen_annual');
  });

  it('creates and confirms a subscription from a Culqi token', async () => {
    const service = new BillingService(userRepository, subscriptionRepository, configService, culqiClient, dataSource);

    await expect(
      service.confirmSubscription('user-1', {
        planCode: 'monthly',
        currency: 'PEN',
        tokenId: 'tok_test_123',
      }),
    ).resolves.toMatchObject({
      status: 'active',
      plan: 'monthly',
      currency: 'PEN',
      customerId: 'cus_test_123',
      subscriptionId: 'sxn_test_123',
    });

    expect(culqiClient.createCustomer).toHaveBeenCalled();
    expect(culqiClient.createCard).toHaveBeenCalledWith({
      customer_id: 'cus_test_123',
      token_id: 'tok_test_123',
    });
    expect(culqiClient.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: 'pln_pen_monthly',
        card_id: 'card_test_123',
        tyc: true,
      }),
    );
  });

  it('does not create a duplicate active subscription', async () => {
    subscriptionRepository.findOne.mockResolvedValueOnce({
      id: 'billing-1',
      status: 'active',
      plan: 'monthly',
      currency: 'PEN',
      currentPeriodEnd: null,
      providerCustomerId: 'cus_existing',
      providerSubscriptionId: 'sxn_existing',
    });
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'cliente@demo.pe',
      fullName: 'Cliente Demo',
      companyName: 'Demo SAC',
      billingStatus: 'active',
      billingPlan: 'monthly',
      billingProvider: 'culqi',
      billingCurrency: 'PEN',
      billingPeriodEnd: null,
      billingCustomerId: 'cus_existing',
      billingSubscriptionId: 'sxn_existing',
    });
    const service = new BillingService(userRepository, subscriptionRepository, configService, culqiClient, dataSource);

    await expect(
      service.confirmSubscription('user-1', {
        planCode: 'monthly',
        currency: 'PEN',
        tokenId: 'tok_duplicate',
      }),
    ).resolves.toMatchObject({
      status: 'active',
      plan: 'monthly',
      subscriptionId: 'sxn_existing',
    });
    expect(culqiClient.createCustomer).not.toHaveBeenCalled();
    expect(culqiClient.createSubscription).not.toHaveBeenCalled();
  });

  it('keeps billing pending when Culqi omits the subscription status', async () => {
    culqiClient.createSubscription.mockResolvedValueOnce({
      id: 'sxn_pending',
      next_billing_date: 1767225600,
    });
    const service = new BillingService(userRepository, subscriptionRepository, configService, culqiClient, dataSource);

    await expect(
      service.confirmSubscription('user-1', {
        planCode: 'monthly',
        currency: 'PEN',
        tokenId: 'tok_pending',
      }),
    ).resolves.toMatchObject({
      status: 'pending',
      plan: 'monthly',
    });
  });

  it('returns the current billing state', async () => {
    const service = new BillingService(userRepository, subscriptionRepository, configService, culqiClient, dataSource);

    await expect(service.getBillingState('user-1')).resolves.toMatchObject({
      status: 'inactive',
      plan: null,
      provider: 'culqi',
      currency: null,
    });
  });

  it.each([
    ['subscription.creation.succeeded', 'active'],
    ['subscription.charge.succeeded', 'active'],
    ['subscription.charge.failed', 'past_due'],
    ['subscription.cancel.succeeded', 'canceled'],
  ])('updates user access after webhook %s', async (event, expectedStatus) => {
    const user = {
      id: 'user-1',
      billingStatus: 'pending',
      billingPlan: 'monthly',
      billingProvider: 'culqi',
      billingCurrency: 'PEN',
      billingPeriodEnd: null,
      billingCustomerId: 'cus_test_123',
      billingSubscriptionId: 'sxn_test_123',
    };
    const record = {
      id: 'billing-1',
      user,
      status: 'pending',
      plan: 'monthly',
      currency: 'PEN',
      currentPeriodEnd: null,
      providerCustomerId: 'cus_test_123',
      providerSubscriptionId: 'sxn_test_123',
    };
    subscriptionRepository.findOne.mockResolvedValueOnce(record);
    const service = new BillingService(userRepository, subscriptionRepository, configService, culqiClient, dataSource);

    await expect(
      service.handleWebhook({
        event,
        data: { id: 'sxn_test_123' },
      } as any),
    ).resolves.toEqual({ ok: true, matched: true });

    expect(record.status).toBe(expectedStatus);
    expect(user.billingStatus).toBe(expectedStatus);
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ billingStatus: expectedStatus }),
    );
  });

  it('ignores unrelated webhook events without changing billing', async () => {
    const service = new BillingService(userRepository, subscriptionRepository, configService, culqiClient, dataSource);

    await expect(
      service.handleWebhook({ event: 'refund.creation.succeeded' } as any),
    ).resolves.toEqual({ ok: true, ignored: true });
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
    expect(userRepository.save).not.toHaveBeenCalled();
  });
});
