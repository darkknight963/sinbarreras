import { BillingController } from './billing.controller';

describe('BillingController', () => {
  it('delegates checkout and billing state access to the service', async () => {
    const billingService = {
      listPlans: jest.fn(async () => [{ code: 'monthly', currency: 'PEN' }]),
      getBillingState: jest.fn(async () => ({ status: 'inactive' })),
      createCheckoutSession: jest.fn(async () => ({ publicKey: 'pk_test_123' })),
      confirmSubscription: jest.fn(async () => ({ status: 'active' })),
      cancelSubscription: jest.fn(async () => ({ status: 'canceled' })),
      getWebhookSecret: jest.fn(() => 'whsec_test_123'),
      handleWebhook: jest.fn(async () => ({ ok: true })),
    } as any;

    const controller = new BillingController(billingService);

    await expect(controller.listPlans()).resolves.toEqual([{ code: 'monthly', currency: 'PEN' }]);
    await expect(controller.getBilling({ id: 'user-1' })).resolves.toEqual({ status: 'inactive' });
    await expect(
      controller.createCheckout({ id: 'user-1' }, { planCode: 'monthly', currency: 'PEN' } as any),
    ).resolves.toEqual({ publicKey: 'pk_test_123' });
    await expect(
      controller.confirmSubscription({ id: 'user-1' }, { planCode: 'monthly', currency: 'PEN', tokenId: 'tok' } as any),
    ).resolves.toEqual({ status: 'active' });
    await expect(controller.cancel({ id: 'user-1' })).resolves.toEqual({ status: 'canceled' });
    await expect(
      controller.handleWebhook(
        { event: 'subscription.creation.succeeded' } as any,
        { headers: { 'x-culqi-webhook-secret': 'whsec_test_123' } } as any,
      ),
    ).resolves.toEqual({
      ok: true,
    });
  });
});
