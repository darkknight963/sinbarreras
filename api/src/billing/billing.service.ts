import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, DataSource } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { BillingSubscription } from './entities/billing-subscription.entity';
import {
  BILLING_PLAN_CONFIGS,
  BILLING_PROVIDER,
  BillingCurrency,
  BillingPlan,
  BillingPlanCode,
  BillingState,
  BillingStatus,
} from './billing.types';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { ConfirmSubscriptionDto } from './dto/confirm-subscription.dto';
import { MpWebhookDto } from './dto/mp-webhook.dto';

@Injectable()
export class BillingService {
  private static readonly MP_API_BASE_URL = 'https://api.mercadopago.com';

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(BillingSubscription)
    private readonly subscriptionRepository: Repository<BillingSubscription>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async listPlans(): Promise<BillingPlan[]> {
    return BILLING_PLAN_CONFIGS.map((plan) => this.resolveBillingPlan(plan));
  }

  async getBillingState(userId: string): Promise<BillingState> {
    const user = await this.getUserOrThrow(userId);
    return this.serializeBillingState(user);
  }

  async createCheckoutSession(userId: string, dto: CreateCheckoutSessionDto) {
    const user = await this.getUserOrThrow(userId);
    const plan = await this.resolvePlan(dto.planCode, dto.currency);
    if (!plan.amount) {
      throw new BadRequestException(`No existe el monto configurado para ${plan.label} en ${plan.currency}`);
    }

    const accessToken = this.getMercadoPagoAccessToken();
    const externalReference = this.buildExternalReference(user.id, plan.code, plan.currency);
    const frontendUrl = this.getFrontendUrl(dto.returnUrl);
    const response = await fetch(`${BillingService.MP_API_BASE_URL}/preapproval`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        reason: `${plan.label} - ${plan.description}`,
        external_reference: externalReference,
        payer_email: user.email,
        back_url: this.buildReturnUrl(frontendUrl, plan, 'success'),
        status: 'pending',
        auto_recurring: {
          frequency: plan.code === 'annual' ? 12 : 1,
          frequency_type: 'months',
          transaction_amount: this.toMercadoPagoAmount(plan.amount),
          currency_id: plan.currency,
        },
      }),
    });

    if (!response.ok) {
      throw new BadRequestException(await this.readMercadoPagoError(response));
    }

    const payload = await response.json() as Record<string, unknown>;

    return {
      plan,
      amount: plan.amount,
      initPoint: String(payload.init_point || ''),
      sandboxInitPoint: String(payload.sandbox_init_point || ''),
      checkoutUrl: String(payload.init_point || payload.sandbox_init_point || ''),
      preapprovalId: payload.id ? String(payload.id) : null,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        companyName: user.companyName,
      },
    };
  }

  async confirmSubscription(userId: string, dto: ConfirmSubscriptionDto) {
    const user = await this.getUserOrThrow(userId);
    const plan = await this.resolvePlan(dto.planCode, dto.currency);

    const existingActive = await this.subscriptionRepository.findOne({
      where: {
        user: { id: user.id },
        plan: plan.code,
        currency: plan.currency,
        status: 'active',
      },
      order: { createdAt: 'DESC' },
    });
    if (existingActive) {
      await this.updateUserBilling(user, {
        status: existingActive.status,
        plan: existingActive.plan,
        currency: existingActive.currency,
        currentPeriodEnd: existingActive.currentPeriodEnd,
        customerId: existingActive.providerCustomerId,
        subscriptionId: existingActive.providerSubscriptionId,
      });
      return this.serializeBillingState(user);
    }

    if (dto.preapprovalId) {
      const preapproval = await this.getMercadoPagoPreapproval(dto.preapprovalId);
      const subscriptionStatus = String(preapproval.status || '').toLowerCase();
      const billingStatus = this.mapPreapprovalStatus(subscriptionStatus);
      await this.upsertBillingFromPreapproval(user, plan.code, plan.currency, dto.preapprovalId, preapproval, billingStatus);
      return this.serializeBillingState(await this.getUserOrThrow(user.id));
    }

    if (!dto.paymentId) {
      throw new BadRequestException('Mercado Pago no devolvio una referencia de pago o suscripcion');
    }

    const payment = await this.getMercadoPagoPayment(dto.paymentId);
    const paymentStatus = String(payment.status || '').toLowerCase();
    const billingStatus = this.mapPaymentStatus(paymentStatus);
    await this.upsertBillingFromPayment(user, plan.code, plan.currency, dto.paymentId, payment, billingStatus);
    return this.serializeBillingState(await this.getUserOrThrow(user.id));
  }

  async cancelSubscription(userId: string) {
    const user = await this.getUserOrThrow(userId);
    const activeSubscription = await this.subscriptionRepository.findOne({
      where: { user: { id: user.id }, status: 'active' },
      order: { createdAt: 'DESC' },
    });

    await this.dataSource.transaction(async (manager) => {
      if (activeSubscription) {
        activeSubscription.status = 'canceled';
        await manager.save(BillingSubscription, activeSubscription);
      }
      await manager.update(User, user.id, {
        billingStatus: 'canceled',
        billingPlan: null,
        billingCurrency: null,
        billingPeriodEnd: null,
        billingCustomerId: activeSubscription?.providerCustomerId ?? user.billingCustomerId,
        billingSubscriptionId: activeSubscription?.providerSubscriptionId ?? user.billingSubscriptionId,
      });
    });

    // TODO: cancelar suscripción en Mercado Pago si providerSubscriptionId existe

    return this.serializeBillingState(await this.getUserOrThrow(userId));
  }

  async handleWebhook(payload: MpWebhookDto | Record<string, unknown>) {
    const eventType = String(payload.type || payload.action || '');
    const data = (payload.data as Record<string, unknown> | undefined) || {};
    const resourceId = String(data.id || payload.id || '');

    console.log('[BillingService] MP webhook recibido:', { eventType, resourceId });

    if (!eventType) {
      return { ok: true, ignored: true };
    }

    if (!resourceId) {
      return { ok: true, matched: false };
    }

    if (this.isPreapprovalWebhook(eventType, payload, resourceId)) {
      const preapproval = await this.getMercadoPagoPreapproval(resourceId);
      const externalReference = String(preapproval.external_reference || '');
      const parsedReference = this.parseExternalReference(externalReference);
      if (!parsedReference) {
        return { ok: true, matched: false };
      }

      const user = await this.userRepository.findOne({ where: { id: parsedReference.userId } });
      if (!user) {
        return { ok: true, matched: false };
      }

      await this.upsertBillingFromPreapproval(
        user,
        parsedReference.planCode,
        parsedReference.currency,
        resourceId,
        preapproval,
        this.mapPreapprovalStatus(String(preapproval.status || '').toLowerCase()),
      );

      return { ok: true, matched: true };
    }

    const payment = await this.getMercadoPagoPayment(resourceId);
    const paymentStatus = String(payment.status || '').toLowerCase();
    const externalReference = String(payment.external_reference || '');
    const parsedReference = this.parseExternalReference(externalReference);

    if (!parsedReference) {
      return { ok: true, matched: false };
    }

    const user = await this.userRepository.findOne({ where: { id: parsedReference.userId } });
    if (!user) {
      return { ok: true, matched: false };
    }

    await this.upsertBillingFromPayment(
      user,
      parsedReference.planCode,
      parsedReference.currency,
      resourceId,
      payment,
      this.mapPaymentStatus(paymentStatus),
    );

    return { ok: true, matched: true };
  }

  getWebhookSecret(): string {
    return this.configService.get<string>('MP_WEBHOOK_SECRET', '').trim();
  }

  private getMercadoPagoAccessToken() {
    const token = this.configService.get<string>('MP_ACCESS_TOKEN', '').trim();
    if (!token) {
      throw new BadRequestException('Falta configurar MP_ACCESS_TOKEN');
    }
    return token;
  }

  private getFrontendUrl(returnUrl?: string) {
    const candidate =
      returnUrl?.trim() ||
      this.configService.get<string>('FRONTEND_URL', '').trim() ||
      process.env.FRONTEND_URL?.trim() ||
      'http://localhost:5173';
    return candidate.replace(/\/+$/, '');
  }

  private getPublicApiBaseUrl() {
    const configured =
      this.configService.get<string>('PUBLIC_API_BASE_URL', '').trim() ||
      this.configService.get<string>('API_PUBLIC_URL', '').trim() ||
      this.configService.get<string>('BACKEND_URL', '').trim() ||
      process.env.PUBLIC_API_BASE_URL?.trim() ||
      process.env.API_PUBLIC_URL?.trim() ||
      process.env.BACKEND_URL?.trim();

    if (configured) {
      return configured.replace(/\/+$/, '');
    }

    const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
    if (railwayDomain) {
      return `https://${railwayDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
    }

    throw new BadRequestException('Falta configurar PUBLIC_API_BASE_URL para recibir webhooks de Mercado Pago');
  }

  private buildReturnUrl(frontendUrl: string, plan: BillingPlan, checkoutStatus: 'success' | 'pending' | 'failure') {
    const url = new URL(frontendUrl);
    url.searchParams.set('checkout', checkoutStatus);
    url.searchParams.set('plan', plan.code);
    url.searchParams.set('currency', plan.currency);
    return url.toString();
  }

  private buildExternalReference(userId: string, planCode: BillingPlanCode, currency: BillingCurrency) {
    return `sb|${userId}|${planCode}|${currency}`;
  }

  private parseExternalReference(value: string) {
    const [prefix, userId, planCode, currency] = value.split('|');
    if (
      prefix !== 'sb' ||
      !userId ||
      (planCode !== 'monthly' && planCode !== 'annual') ||
      (currency !== 'PEN' && currency !== 'USD')
    ) {
      return null;
    }

    return {
      userId,
      planCode: planCode as BillingPlanCode,
      currency: currency as BillingCurrency,
    };
  }

  private async getMercadoPagoPayment(paymentId: string) {
    const accessToken = this.getMercadoPagoAccessToken();
    const response = await fetch(`${BillingService.MP_API_BASE_URL}/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new BadRequestException(await this.readMercadoPagoError(response));
    }

    return await response.json() as Record<string, unknown>;
  }

  private async getMercadoPagoPreapproval(preapprovalId: string) {
    const accessToken = this.getMercadoPagoAccessToken();
    const response = await fetch(`${BillingService.MP_API_BASE_URL}/preapproval/${preapprovalId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new BadRequestException(await this.readMercadoPagoError(response));
    }

    return await response.json() as Record<string, unknown>;
  }

  private async readMercadoPagoError(response: Response) {
    try {
      const body = await response.json() as Record<string, unknown>;
      return String(body.message || body.error || `Mercado Pago HTTP ${response.status}`);
    } catch {
      return `Mercado Pago HTTP ${response.status}`;
    }
  }

  private mapPaymentStatus(status: string): BillingStatus {
    if (status === 'approved') return 'active';
    if (status === 'in_process' || status === 'pending') return 'pending';
    if (status === 'cancelled' || status === 'cancelled_by_user' || status === 'refunded' || status === 'charged_back') {
      return 'canceled';
    }
    return 'past_due';
  }

  private mapPreapprovalStatus(status: string): BillingStatus {
    if (status === 'authorized' || status === 'active') return 'active';
    if (status === 'pending') return 'pending';
    if (status === 'cancelled' || status === 'cancelled_by_user') return 'canceled';
    return 'past_due';
  }

  private resolvePeriodEnd(planCode: BillingPlanCode, payment: Record<string, unknown>) {
    const approvedAt = typeof payment.date_approved === 'string' ? payment.date_approved : null;
    const paidAt = approvedAt ? new Date(approvedAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) {
      return null;
    }

    const currentPeriodEnd = new Date(paidAt);
    if (planCode === 'annual') {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    } else {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    }
    return currentPeriodEnd;
  }

  private resolveSubscriptionPeriodEnd(planCode: BillingPlanCode, subscription: Record<string, unknown>) {
    const nextPaymentDate = typeof subscription.next_payment_date === 'string' ? subscription.next_payment_date : null;
    if (nextPaymentDate) {
      const parsed = new Date(nextPaymentDate);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    const lastModified = typeof subscription.last_modified === 'string' ? subscription.last_modified : null;
    const anchor = lastModified ? new Date(lastModified) : new Date();
    if (Number.isNaN(anchor.getTime())) {
      return null;
    }

    const currentPeriodEnd = new Date(anchor);
    if (planCode === 'annual') {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    } else {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    }
    return currentPeriodEnd;
  }

  private toMercadoPagoAmount(amount: number) {
    return amount >= 1000 ? amount / 100 : amount;
  }

  private async upsertBillingFromPayment(
    user: User,
    planCode: BillingPlanCode,
    currency: BillingCurrency,
    paymentId: string,
    payment: Record<string, unknown>,
    status: BillingStatus,
  ) {
    const providerCustomerId =
      (payment.payer && typeof payment.payer === 'object' && 'id' in payment.payer && payment.payer.id !== null)
        ? String(payment.payer.id)
        : null;
    const currentPeriodEnd = status === 'active' ? this.resolvePeriodEnd(planCode, payment) : null;
    const existingRecord = await this.subscriptionRepository.findOne({
      where: { providerSubscriptionId: paymentId },
    });

    const billingRecord = existingRecord || this.subscriptionRepository.create({
      user,
      provider: BILLING_PROVIDER,
      plan: planCode,
      currency,
    });

    billingRecord.user = user;
    billingRecord.plan = planCode;
    billingRecord.currency = currency;
    billingRecord.status = status;
    billingRecord.providerPlanId = null;
    billingRecord.providerCustomerId = providerCustomerId;
    billingRecord.providerSubscriptionId = paymentId;
    billingRecord.providerCardId = null;
    billingRecord.providerTokenId = null;
    billingRecord.currentPeriodEnd = currentPeriodEnd;
    billingRecord.metadata = payment;

    await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(BillingSubscription, billingRecord);
      const userUpdate = {
        billingStatus: saved.status,
        billingPlan: saved.status === 'canceled' ? null : planCode,
        billingCurrency: saved.status === 'canceled' ? null : currency,
        billingPeriodEnd: saved.currentPeriodEnd,
        billingCustomerId: saved.providerCustomerId,
        billingSubscriptionId: saved.providerSubscriptionId,
      };
      Object.assign(user, userUpdate);
      await manager.update(User, user.id, userUpdate);
    });
  }

  private async upsertBillingFromPreapproval(
    user: User,
    planCode: BillingPlanCode,
    currency: BillingCurrency,
    preapprovalId: string,
    preapproval: Record<string, unknown>,
    status: BillingStatus,
  ) {
    const providerCustomerId =
      preapproval.payer_id !== null && preapproval.payer_id !== undefined
        ? String(preapproval.payer_id)
        : null;
    const currentPeriodEnd = status === 'active' ? this.resolveSubscriptionPeriodEnd(planCode, preapproval) : null;
    const existingRecord = await this.subscriptionRepository.findOne({
      where: { providerSubscriptionId: preapprovalId },
    });

    const billingRecord = existingRecord || this.subscriptionRepository.create({
      user,
      provider: BILLING_PROVIDER,
      plan: planCode,
      currency,
    });

    billingRecord.user = user;
    billingRecord.plan = planCode;
    billingRecord.currency = currency;
    billingRecord.status = status;
    billingRecord.providerPlanId = null;
    billingRecord.providerCustomerId = providerCustomerId;
    billingRecord.providerSubscriptionId = preapprovalId;
    billingRecord.providerCardId = null;
    billingRecord.providerTokenId = null;
    billingRecord.currentPeriodEnd = currentPeriodEnd;
    billingRecord.metadata = preapproval;

    await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(BillingSubscription, billingRecord);
      const userUpdate = {
        billingStatus: saved.status,
        billingPlan: saved.status === 'canceled' ? null : planCode,
        billingCurrency: saved.status === 'canceled' ? null : currency,
        billingPeriodEnd: saved.currentPeriodEnd,
        billingCustomerId: saved.providerCustomerId,
        billingSubscriptionId: saved.providerSubscriptionId,
      };
      Object.assign(user, userUpdate);
      await manager.update(User, user.id, userUpdate);
    });
  }

  private isPreapprovalWebhook(eventType: string, payload: MpWebhookDto | Record<string, unknown>, resourceId: string) {
    const resource = String((payload as Record<string, unknown>).resource || '').toLowerCase();
    return eventType.toLowerCase().includes('preapproval') || resource.includes('/preapproval/') || !/^\d+$/.test(resourceId);
  }

  private async resolvePlan(planCode: BillingPlanCode, currency: BillingCurrency) {
    const plans = await this.listPlans();
    const plan = plans.find((item) => item.code === planCode && item.currency === currency);
    if (!plan) {
      throw new NotFoundException(`No existe el plan ${planCode} en ${currency}`);
    }
    return plan;
  }

  private async getUserOrThrow(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Sesión inválida');
    }
    return user;
  }

  private serializeBillingState(user: User): BillingState {
    return {
      status: user.billingStatus,
      plan: user.billingPlan,
      provider: user.billingProvider,
      currency: user.billingCurrency,
      currentPeriodEnd: user.billingPeriodEnd ? user.billingPeriodEnd.toISOString() : null,
      customerId: user.billingCustomerId,
      subscriptionId: user.billingSubscriptionId,
    };
  }

  private async updateUserBilling(
    user: User,
    state: {
      status: BillingStatus;
      plan: BillingPlanCode | null;
      currency: BillingCurrency | null;
      currentPeriodEnd: Date | null;
      customerId: string | null;
      subscriptionId: string | null;
    },
  ) {
    user.billingStatus = state.status;
    user.billingPlan = state.plan;
    user.billingCurrency = state.currency;
    user.billingPeriodEnd = state.currentPeriodEnd;
    user.billingCustomerId = state.customerId;
    user.billingSubscriptionId = state.subscriptionId;
    await this.userRepository.save(user);
  }

  private resolveBillingPlan(plan: (typeof BILLING_PLAN_CONFIGS)[number]): BillingPlan {
    const rawAmount = this.configService.get<string>(plan.amountEnv, '')?.trim();
    const amount = this.parseAmount(rawAmount);
    return {
      ...plan,
      provider: BILLING_PROVIDER,
      amount,
      available: Boolean(amount),
    };
  }

  private parseAmount(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
  }

}
