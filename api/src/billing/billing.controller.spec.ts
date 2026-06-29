import { createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { BillingController } from './billing.controller';

function makeSignedRequest(payload: object, secret: string): { headers: Record<string, string>; rawBody: Buffer } {
  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
  return { headers: { 'x-signature': `sha256=${signature}` }, rawBody };
}

describe('BillingController', () => {
  it('delegates billing actions to the service', async () => {
    const billingService = {
      listPlans: jest.fn(async () => [{ code: 'monthly', currency: 'PEN' }]),
      getBillingState: jest.fn(async () => ({ status: 'inactive' })),
      createCheckoutSession: jest.fn(async () => ({ preapprovalId: 'preapproval-123' })),
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
    ).resolves.toEqual({ preapprovalId: 'preapproval-123' });
    await expect(
      controller.confirmSubscription({ id: 'user-1' }, { planCode: 'monthly', currency: 'PEN', preapprovalId: 'preapproval-123' } as any),
    ).resolves.toEqual({ status: 'active' });
    await expect(controller.cancel({ id: 'user-1' })).resolves.toEqual({ status: 'canceled' });

    const webhookPayload = { type: 'preapproval', data: { id: 'preapproval-123' } };
    const { headers, rawBody } = makeSignedRequest(webhookPayload, 'whsec_test_123');
    await expect(
      controller.handleWebhook(webhookPayload as any, { headers, rawBody } as any),
    ).resolves.toEqual({ ok: true });
  });

  it('rejects an invalid Mercado Pago webhook signature', () => {
    const billingService = {
      getWebhookSecret: jest.fn(() => 'whsec_test_123'),
      handleWebhook: jest.fn(),
    } as any;
    const controller = new BillingController(billingService);

    expect(() =>
      controller.handleWebhook(
        { type: 'preapproval', data: { id: 'preapproval-123' } } as any,
        { headers: { 'x-signature': 'sha256=badfeed' }, rawBody: Buffer.from('{}') } as any,
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
      controller.handleWebhook({ type: 'preapproval', data: { id: 'preapproval-123' } } as any, { headers: {} } as any),
    ).resolves.toEqual({ ok: true });
  });
});
