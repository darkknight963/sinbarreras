import { UnauthorizedException } from '@nestjs/common';
import { BillingController } from './billing.controller';

const WEBHOOK_USER = 'webhook_user';
const WEBHOOK_PASS = 'webhook_pass';

function makeBasicAuthHeader(user: string, pass: string) {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

describe('BillingController', () => {
  it('delegates billing actions to the service', async () => {
    const billingService = {
      listPlans: jest.fn(async () => [{ code: 'monthly', currency: 'PEN' }]),
      getBillingState: jest.fn(async () => ({ status: 'inactive' })),
      createCheckoutSession: jest.fn(async () => ({ status: 'active', subscriptionId: 'sub_test_789' })),
      cancelSubscription: jest.fn(async () => ({ status: 'canceled' })),
      getWebhookCredentials: jest.fn(() => ({ webhookUser: WEBHOOK_USER, webhookPassword: WEBHOOK_PASS })),
      handleWebhook: jest.fn(async () => ({ ok: true })),
    } as any;

    const controller = new BillingController(billingService);

    await expect(controller.listPlans()).resolves.toEqual([{ code: 'monthly', currency: 'PEN' }]);
    await expect(controller.getBilling({ id: 'user-1' })).resolves.toEqual({ status: 'inactive' });
    await expect(
      controller.createCheckout({ id: 'user-1' }, { planCode: 'monthly', currency: 'PEN', culqiToken: 'tkn_test' } as any),
    ).resolves.toEqual({ status: 'active', subscriptionId: 'sub_test_789' });
    await expect(controller.cancel({ id: 'user-1' })).resolves.toEqual({ status: 'canceled' });

    const webhookPayload = { type: 'subscription.charge.succeeded', data: { subscription_id: 'sub_test_789' } };
    await expect(
      controller.handleWebhook(webhookPayload as any, {
        headers: { authorization: makeBasicAuthHeader(WEBHOOK_USER, WEBHOOK_PASS) },
      } as any),
    ).resolves.toEqual({ ok: true });
  });

  it('rejects a Culqi webhook with wrong Basic Auth credentials', () => {
    const billingService = {
      getWebhookCredentials: jest.fn(() => ({ webhookUser: WEBHOOK_USER, webhookPassword: WEBHOOK_PASS })),
      handleWebhook: jest.fn(),
    } as any;
    const controller = new BillingController(billingService);

    expect(() =>
      controller.handleWebhook(
        { type: 'subscription.charge.succeeded', data: {} } as any,
        { headers: { authorization: makeBasicAuthHeader('wrong', 'creds') } } as any,
      ),
    ).toThrow(UnauthorizedException);
    expect(billingService.handleWebhook).not.toHaveBeenCalled();
  });

  it('accepts webhooks without auth when no credentials are configured', async () => {
    const billingService = {
      getWebhookCredentials: jest.fn(() => ({ webhookUser: '', webhookPassword: '' })),
      handleWebhook: jest.fn(async () => ({ ok: true })),
    } as any;
    const controller = new BillingController(billingService);

    await expect(
      controller.handleWebhook(
        { type: 'subscription.charge.succeeded', data: {} } as any,
        { headers: {} } as any,
      ),
    ).resolves.toEqual({ ok: true });
  });
});
