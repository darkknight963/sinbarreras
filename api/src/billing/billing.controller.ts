import { Body, Controller, Get, Post, Req, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
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
    if (!user) throw new UnauthorizedException('Sesión inválida');
    return this.billingService.getBillingState(user.id);
  }

  @Post('checkout')
  createCheckout(
    @CurrentUser() user: { id: string } | null,
    @Body() dto: CreateCheckoutSessionDto & { culqiToken?: string },
  ) {
    if (!user) throw new UnauthorizedException('Sesión inválida');
    return this.billingService.createCheckoutSession(user.id, dto);
  }

  @Post('cancel')
  cancel(@CurrentUser() user: { id: string } | null) {
    if (!user) throw new UnauthorizedException('Sesión inválida');
    return this.billingService.cancelSubscription(user.id);
  }

  @Public()
  @Post('webhooks/culqi')
  handleWebhook(
    @Body() payload: Record<string, unknown>,
    @Req() request: Request,
  ) {
    const { webhookUser, webhookPassword } = this.billingService.getWebhookCredentials();

    if (webhookUser && webhookPassword) {
      const authHeader = String(request.headers['authorization'] || '').trim();
      if (!authHeader.startsWith('Basic ')) {
        throw new UnauthorizedException('Credenciales de webhook requeridas');
      }

      const encoded = authHeader.slice(6);
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const colonIdx = decoded.indexOf(':');
      const incomingUser = colonIdx >= 0 ? decoded.slice(0, colonIdx) : decoded;
      const incomingPass = colonIdx >= 0 ? decoded.slice(colonIdx + 1) : '';

      const expectedUser = Buffer.from(webhookUser);
      const expectedPass = Buffer.from(webhookPassword);
      const incomingUserBuf = Buffer.from(incomingUser);
      const incomingPassBuf = Buffer.from(incomingPass);

      const userMatch =
        expectedUser.length === incomingUserBuf.length &&
        timingSafeEqual(expectedUser, incomingUserBuf);
      const passMatch =
        expectedPass.length === incomingPassBuf.length &&
        timingSafeEqual(expectedPass, incomingPassBuf);

      if (!userMatch || !passMatch) {
        throw new UnauthorizedException('Credenciales de webhook inválidas');
      }
    }

    return this.billingService.handleWebhook(payload);
  }
}
