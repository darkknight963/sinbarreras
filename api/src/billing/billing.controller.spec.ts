import { createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { BillingController } from './billing.controller';

function makeSignedRequest(payload: object, secret: string): { headers: Record<string, string>; rawBody: Buffer } {
  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
  return { headers: { 'x-culqi-signature': signature }, rawBody };
}

describe('BillingController', () => {
  it('delegates billing actions to the service', async () => {
    const billingService = {
      listPlans: jest.fn(async () => [{ code: 'monthly', currency: 'PEN' }]),
      getBillingState: jest.fn(async () => ({ status: 'inactive' })),
      createCheckoutSession: jest.fn(async () => ({ status: 'active', subscriptionId: 'sub_test_789' })),
      cancelSubscription: jest.fn(async () => ({ status: 'canceled' })),
      getWebhookSecret: jest.fn(() => 'whsec_test_123'),
      handleWebhook: jest.fn(async () => ({ ok: true })),
    } as any;

    const controller = new BillingController(billingService);

    await expect(controller.listPlans()).resolves.toEqual([{ code: 'monthly', currency: 'PEN' }]);
    await expect(controller.getBilling({ id: 'user-1' })).resolves.toEqual({ status: 'inactive' });
    await expect(
      controller.createCheckout({ id: 'user-1' }, { planCode: 'monthly', currency: 'PEN', culqiToken: 'tkn_test' } as any),
    ).resolves.toEqual({ status: 'active', subscriptionId: 'sub_test_789' });
    await expect(controller.cancel({ id: 'user-1' })).resolves.toEqual({ status: 'canceled' });

    const webhookPayload = { type: 'subscription.charge.success', data: { subscription_id: 'sub_test_789' } };
    const { headers, rawBody } = makeSignedRequest(webhookPayload, 'whsec_test_123');
    await expect(
      controller.handleWebhook(webhookPayload as any, { headers, rawBody } as any),
    ).resolves.toEqual({ ok: true });
  });

  it('rejects a Culqi webhook with invalid signature', () => {
    const billingService = {
      getWebhookSecret: jest.fn(() => 'whsec_test_123'),
      handleWebhook: jest.fn(),
    } as any;
    const controller = new BillingController(billingService);

    expect(() =>
      controller.handleWebhook(
        { type: 'subscription.charge.success', data: { subscription_id: 'sub_test' } } as any,
        { headers: { 'x-culqi-signature': 'badfeed' }, rawBody: Buffer.from('{}') } as any,
      ),
    ).toThrow(UnauthorizedException);
    expect(billingService.handleWebhook).not.toHaveBeenCalled();
  });

  it('accepts webhooks without signature when no secret is configured', async () => {
    const billingService = {
      getWebhookSecret: jest.fn(() => ''),
      handleWebhook: jest.fn(async () => ({ ok: true })),
    } as any;
    const controller = new BillingController(billingService);

    await expect(
      controller.handleWebhook(
        { type: 'subscription.charge.success', data: { subscription_id: 'sub_test' } } as any,
        { headers: {} } as any,
      ),
    ).resolves.toEqual({ ok: true });
  });
});
