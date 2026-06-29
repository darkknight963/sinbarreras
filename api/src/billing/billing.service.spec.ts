import { BillingService } from './billing.service';

describe('BillingService', () => {
  const userRepository = {
    findOne: jest.fn(),
    save: jest.fn(async (value) => value),
  } as any;

  const subscriptionRepository = {
    create: jest.fn((value) => value),
    findOne: jest.fn(),
  } as any;

  const configService = {
    get: jest.fn((key: string, fallback?: string) => {
      const values: Record<string, string> = {
        MP_ACCESS_TOKEN: 'TEST-access-token',
        MP_MONTHLY_PEN_AMOUNT: '7900',
        MP_ANNUAL_PEN_AMOUNT: '79000',
        FRONTEND_URL: 'https://sinbarreras.gzakgroup.com',
        PUBLIC_API_BASE_URL: 'https://sinbarreras-production.up.railway.app',
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
      billingProvider: 'mercadopago',
      billingCurrency: null,
      billingPeriodEnd: null,
      billingCustomerId: null,
      billingSubscriptionId: null,
    });
    subscriptionRepository.findOne.mockResolvedValue(null);
    global.fetch = jest.fn() as any;
  });

  it('lists Mercado Pago plans from env amounts', async () => {
    const service = new BillingService(userRepository, subscriptionRepository, configService, dataSource);

    await expect(service.listPlans()).resolves.toEqual([
      expect.objectContaining({ code: 'monthly', currency: 'PEN', available: true, amount: 7900 }),
      expect.objectContaining({ code: 'annual', currency: 'PEN', available: true, amount: 79000 }),
      expect.objectContaining({ code: 'monthly', currency: 'USD', available: false, amount: null }),
      expect.objectContaining({ code: 'annual', currency: 'USD', available: false, amount: null }),
    ]);
  });

  it('creates a Mercado Pago preapproval checkout session', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'preapproval-123',
        init_point: 'https://www.mercadopago.com/checkout/v1/redirect?preapproval_id=preapproval-123',
        sandbox_init_point: 'https://sandbox.mercadopago.com/checkout/v1/redirect?preapproval_id=preapproval-123',
      }),
    });

    const service = new BillingService(userRepository, subscriptionRepository, configService, dataSource);

    await expect(
      service.createCheckoutSession('user-1', { planCode: 'monthly', currency: 'PEN' }),
    ).resolves.toMatchObject({
      amount: 7900,
      preapprovalId: 'preapproval-123',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.mercadopago.com/preapproval',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      }),
    );

    const [, request] = (global.fetch as jest.Mock).mock.calls[0];
    const payload = JSON.parse(request.body as string);
    expect(payload).toMatchObject({
      payer_email: 'cliente@demo.pe',
      status: 'pending',
      external_reference: 'sb|user-1|monthly|PEN',
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: 79,
        currency_id: 'PEN',
      },
    });
  });

  it('uses MP_TEST_PAYER_EMAIL in sandbox subscriptions when configured', async () => {
    const sandboxConfigService = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          MP_ACCESS_TOKEN: 'TEST-access-token',
          MP_MONTHLY_PEN_AMOUNT: '7900',
          FRONTEND_URL: 'https://sinbarreras.gzakgroup.com',
          MP_TEST_PAYER_EMAIL: 'buyer.test.user@mp-example.com',
        };
        return values[key] ?? fallback ?? '';
      }),
    } as any;

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'preapproval-123',
        init_point: 'https://www.mercadopago.com/checkout/v1/redirect?preapproval_id=preapproval-123',
      }),
    });

    const service = new BillingService(userRepository, subscriptionRepository, sandboxConfigService, dataSource);
    await service.createCheckoutSession('user-1', { planCode: 'monthly', currency: 'PEN' });

    const [, request] = (global.fetch as jest.Mock).mock.calls[0];
    const payload = JSON.parse(request.body as string);
    expect(payload.payer_email).toBe('buyer.test.user@mp-example.com');
  });

  it('fails fast when Mercado Pago does not respond in time', async () => {
    jest.useFakeTimers();

    const timeoutConfigService = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          MP_ACCESS_TOKEN: 'APP_USR-real-token',
          MP_MONTHLY_PEN_AMOUNT: '7900',
          FRONTEND_URL: 'https://sinbarreras.gzakgroup.com',
          MP_TIMEOUT_MS: '3000',
        };
        return values[key] ?? fallback ?? '';
      }),
    } as any;

    (global.fetch as jest.Mock).mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const abortError = new Error('aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      });
    });

    const service = new BillingService(userRepository, subscriptionRepository, timeoutConfigService, dataSource);
    const guardedPromise = service
      .createCheckoutSession('user-1', { planCode: 'monthly', currency: 'PEN' })
      .then(() => null)
      .catch((error) => error);

    await jest.advanceTimersByTimeAsync(3000);

    const error = await guardedPromise;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('Mercado Pago no respondio a tiempo');
    jest.useRealTimers();
  });

  it('confirms billing from a Mercado Pago preapproval return', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'preapproval-123',
        status: 'authorized',
        payer_id: 998877,
        external_reference: 'sb|user-1|monthly|PEN',
        next_payment_date: '2026-07-29T00:00:00.000Z',
      }),
    });

    const service = new BillingService(userRepository, subscriptionRepository, configService, dataSource);

    await expect(
      service.confirmSubscription('user-1', {
        planCode: 'monthly',
        currency: 'PEN',
        preapprovalId: 'preapproval-123',
      }),
    ).resolves.toMatchObject({
      status: 'active',
      plan: 'monthly',
      currency: 'PEN',
      customerId: '998877',
      subscriptionId: 'preapproval-123',
    });
  });

  it('updates billing from a preapproval webhook', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'preapproval-123',
        status: 'authorized',
        payer_id: 998877,
        external_reference: 'sb|user-1|monthly|PEN',
        next_payment_date: '2026-07-29T00:00:00.000Z',
      }),
    });

    const service = new BillingService(userRepository, subscriptionRepository, configService, dataSource);

    await expect(
      service.handleWebhook({
        type: 'preapproval',
        action: 'updated',
        data: { id: 'preapproval-123' },
      } as any),
    ).resolves.toEqual({ ok: true, matched: true });
  });
});
