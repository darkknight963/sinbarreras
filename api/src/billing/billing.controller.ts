import { Body, Controller, Get, Post, Req, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { ConfirmSubscriptionDto } from './dto/confirm-subscription.dto';
import { CulqiWebhookDto } from './dto/culqi-webhook.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Public()
  @Get('plans')
  listPlans() {
    return this.billingService.listPlans();
  }

  @Get('me')
  getBilling(@CurrentUser() user: { id: string } | null) {
    if (!user) {
      throw new UnauthorizedException('Sesión inválida');
    }
    return this.billingService.getBillingState(user.id);
  }

  @Post('checkout')
  createCheckout(@CurrentUser() user: { id: string } | null, @Body() dto: CreateCheckoutSessionDto) {
    if (!user) {
      throw new UnauthorizedException('Sesión inválida');
    }
    return this.billingService.createCheckoutSession(user.id, dto);
  }

  @Post('confirm')
  confirmSubscription(@CurrentUser() user: { id: string } | null, @Body() dto: ConfirmSubscriptionDto) {
    if (!user) {
      throw new UnauthorizedException('Sesión inválida');
    }
    return this.billingService.confirmSubscription(user.id, dto);
  }

  @Post('cancel')
  cancel(@CurrentUser() user: { id: string } | null) {
    if (!user) {
      throw new UnauthorizedException('Sesión inválida');
    }
    return this.billingService.cancelSubscription(user.id);
  }

  @Public()
  @Post('webhooks/culqi')
  handleWebhook(
    @Body() payload: CulqiWebhookDto,
    @Req() request: Request & { rawBody?: Buffer },
  ) {
    const webhookSecret = this.billingService.getWebhookSecret();

    if (!webhookSecret) {
      throw new UnauthorizedException('Webhook no configurado: falta CULQI_WEBHOOK_SECRET');
    }

    // Culqi firma el body con HMAC-SHA256. Verificamos contra el raw body para que
    // el parseo JSON no altere la firma. timingSafeEqual previene timing attacks.
    const signature = String(
      request.headers['x-culqi-signature'] ||
      request.headers['x-webhook-signature'] ||
      '',
    ).trim();

    if (!signature) {
      throw new UnauthorizedException('Webhook sin firma HMAC');
    }

    const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(payload));
    const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const incomingBuf = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');

    if (
      expectedBuf.length !== incomingBuf.length ||
      !timingSafeEqual(expectedBuf, incomingBuf)
    ) {
      throw new UnauthorizedException('Firma HMAC de webhook inválida');
    }

    return this.billingService.handleWebhook({
      ...payload,
      metadata: {
        ...(payload.metadata || {}),
        receivedAt: new Date().toISOString(),
        userAgent: request?.headers?.['user-agent'] || '',
      },
    });
  }
}
