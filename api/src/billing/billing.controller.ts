import { Body, Controller, Get, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
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
    @Query('secret') querySecret?: string,
  ) {
    const webhookSecret = this.billingService.getWebhookSecret();

    if (webhookSecret) {
      // Culqi firma el body con HMAC-SHA256 usando el webhook secret.
      // Verificamos con el raw body para que el parseo JSON no altere la firma.
      const signature = String(
        request.headers['x-culqi-signature'] ||
        request.headers['x-webhook-signature'] ||
        '',
      ).trim();

      if (signature) {
        // Verificación HMAC: comparación en tiempo constante para prevenir timing attacks.
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
      } else {
        // Fallback: secret plano en header o query (para compatibilidad con Culqi legacy).
        const incomingSecret = String(
          request.headers['x-culqi-webhook-secret'] ||
          request.headers['x-webhook-secret'] ||
          querySecret ||
          '',
        ).trim();

        const expectedBuf = Buffer.from(webhookSecret);
        const incomingBuf = Buffer.from(incomingSecret);
        if (
          expectedBuf.length !== incomingBuf.length ||
          !timingSafeEqual(expectedBuf, incomingBuf)
        ) {
          throw new UnauthorizedException('Webhook no autorizado');
        }
      }
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

  @Public()
  @Get('webhooks/culqi/config')
  getCulqiWebhookConfig() {
    return this.billingService.getCulqiWebhookConfig();
  }
}
