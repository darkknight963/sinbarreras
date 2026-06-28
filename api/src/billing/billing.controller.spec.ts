import { createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { BillingController } from './billing.controller';

function makeSignedRequest(payload: object, secret: string): { headers: Record<string, string>; rawBody: Buffer } {
  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
  return { headers: { 'x-culqi-signature': signature }, rawBody };
}

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

    const webhookPayload = { event: 'subscription.creation.succeeded' };
    const { headers, rawBody } = makeSignedRequest(webhookPayload, 'whsec_test_123');
    await expect(
      controller.handleWebhook(webhookPayload as any, { headers, rawBody } as any),
    ).resolves.toEqual({ ok: true });
  });

  it('rejects Culqi webhooks without a valid HMAC signature', () => {
    const billingService = {
      getWebhookSecret: jest.fn(() => 'whsec_test_123'),
      handleWebhook: jest.fn(),
    } as any;
    const controller = new BillingController(billingService);

    expect(() =>
      controller.handleWebhook(
        { event: 'subscription.creation.succeeded' } as any,
        { headers: { 'x-culqi-signature': 'badfeed' }, rawBody: Buffer.from('{}') } as any,
      ),
    ).toThrow(UnauthorizedException);
    expect(billingService.handleWebhook).not.toHaveBeenCalled();
  });

  it('rejects webhooks with missing signature header', () => {
    const billingService = {
      getWebhookSecret: jest.fn(() => 'whsec_test_123'),
      handleWebhook: jest.fn(),
    } as any;
    const controller = new BillingController(billingService);

    expect(() =>
      controller.handleWebhook(
        { event: 'subscription.charge.succeeded' } as any,
        { headers: {} } as any,
      ),
    ).toThrow(UnauthorizedException);
    expect(billingService.handleWebhook).not.toHaveBeenCalled();
  });

  it('accepts a valid HMAC-signed webhook', async () => {
    const billingService = {
      getWebhookSecret: jest.fn(() => 'whsec_test_123'),
      handleWebhook: jest.fn(async () => ({ ok: true })),
    } as any;
    const controller = new BillingController(billingService);

    const payload = { event: 'subscription.charge.succeeded' };
    const { headers, rawBody } = makeSignedRequest(payload, 'whsec_test_123');

    await expect(
      controller.handleWebhook(payload as any, { headers, rawBody } as any),
    ).resolves.toEqual({ ok: true });
  });
});
