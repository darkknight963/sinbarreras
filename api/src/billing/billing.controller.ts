import { Body, Controller, Get, Post, Req, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { ConfirmSubscriptionDto } from './dto/confirm-subscription.dto';
import { MpWebhookDto } from './dto/mp-webhook.dto';
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
  @Post('webhooks/mp')
  handleWebhook(
    @Body() payload: MpWebhookDto,
    @Req() request: Request & { rawBody?: Buffer },
  ) {
    const webhookSecret = this.billingService.getWebhookSecret();

    if (webhookSecret) {
      const signature = String(
        request.headers['x-signature'] ||
        request.headers['x-hub-signature-256'] ||
        '',
      ).trim();

      if (signature) {
        const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(payload));
        const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
        const expectedBuf = Buffer.from(expected, 'hex');
        const incomingBuf = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');

        if (
          expectedBuf.length !== incomingBuf.length ||
          !timingSafeEqual(expectedBuf, incomingBuf)
        ) {
          throw new UnauthorizedException('Firma de webhook inválida');
        }
      }
    }

    return this.billingService.handleWebhook(payload);
  }
}
