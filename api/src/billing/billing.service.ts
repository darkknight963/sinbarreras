import { Injectable, NotFoundException, UnauthorizedException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
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

const CULQI_API_BASE = 'https://api.culqi.com/v2';

@Injectable()
export class BillingService {
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

  // Called by frontend to create a Culqi subscription.
  // Accepts a Culqi card token (generated client-side with Culqi.js).
  // Flow: token -> customer -> card -> subscription
  async createCheckoutSession(userId: string, dto: CreateCheckoutSessionDto & { culqiToken?: string }) {
    const user = await this.getUserOrThrow(userId);
    const plan = await this.resolvePlan(dto.planCode, dto.currency);

    if (!plan.amount) {
      throw new BadRequestException(`No hay monto configurado para ${plan.label} en ${plan.currency}`);
    }

    if (!dto.culqiToken) {
      throw new BadRequestException('Se requiere un token de tarjeta generado por Culqi.js');
    }

    const secretKey = this.getCulqiSecretKey();

    // 1. Create or reuse customer
    const customerId = await this.ensureCulqiCustomer(user, secretKey);

    // 2. Create card using the token
    const cardId = await this.createCulqiCard(customerId, dto.culqiToken, secretKey);

    // 3. Create subscription
    const subscription = await this.createCulqiSubscription(customerId, cardId, plan.culqiPlanId, secretKey);

    // 4. Persist billing record
    await this.upsertBillingFromSubscription(user, plan.code, plan.currency, subscription, 'active');

    const fresh = await this.getUserOrThrow(userId);
    return {
      ...this.serializeBillingState(fresh),
      subscriptionId: subscription.id,
    };
  }

  async cancelSubscription(userId: string) {
    const user = await this.getUserOrThrow(userId);
    const activeSubscription = await this.subscriptionRepository.findOne({
      where: { user: { id: user.id }, status: 'active' },
      order: { createdAt: 'DESC' },
    });

    const subId = activeSubscription?.providerSubscriptionId;
    if (subId) {
      try {
        const secretKey = this.getCulqiSecretKey();
        await this.culqiRequest(`/subscriptions/${subId}`, 'DELETE', undefined, secretKey);
      } catch (err) {
        console.error(
          `[BILLING CRITICAL] cancelSubscription en Culqi falló para usuario ${userId} ` +
          `(subscriptionId: ${subId}). Cancelar manualmente en panel Culqi.`,
          err,
        );
      }
    }

    await this.dataSource.transaction(async (manager) => {
      if (activeSubscription) {
        activeSubscription.cancelAtPeriodEnd = true;
        await manager.save(BillingSubscription, activeSubscription);
      }
      await manager.update(User, user.id, { billingCancelAtPeriodEnd: true });
    });

    return this.serializeBillingState(await this.getUserOrThrow(userId));
  }

  async handleWebhook(payload: Record<string, unknown>) {
    const type = String(payload.type || '');
    console.log('[BillingService] Culqi webhook recibido:', { type });

    if (!type) return { ok: true, ignored: true };

    const object = (payload.data as Record<string, unknown> | undefined) || {};

    if (type === 'subscription.charge.succeeded') {
      return this.handleSubscriptionChargeSuccess(object);
    }

    if (type === 'subscription.charge.failed') {
      return this.handleSubscriptionChargeFailed(object);
    }

    if (type === 'subscription.cancel.succeeded' || type === 'subscription.cancel.failed') {
      return this.handleSubscriptionCancel(object);
    }

    return { ok: true, ignored: true };
  }

  getWebhookCredentials(): { webhookUser: string; webhookPassword: string } {
    return {
      webhookUser: this.configService.get<string>('CULQI_WEBHOOK_USER', '').trim(),
      webhookPassword: this.configService.get<string>('CULQI_WEBHOOK_PASSWORD', '').trim(),
    };
  }

  private async handleSubscriptionChargeSuccess(data: Record<string, unknown>) {
    const subscriptionId = String(data.subscription_id || data.id || '');
    if (!subscriptionId) return { ok: true, matched: false };

    const sub = await this.subscriptionRepository.findOne({
      where: { providerSubscriptionId: subscriptionId },
      relations: { user: true },
    });

    if (!sub) return { ok: true, matched: false };

    const nextPeriodEnd = this.computeNextPeriodEnd(sub.plan);
    sub.status = 'active';
    sub.currentPeriodEnd = nextPeriodEnd;
    await this.subscriptionRepository.save(sub);
    await this.userRepository.update(sub.user.id, {
      billingStatus: 'active',
      billingPeriodEnd: nextPeriodEnd,
    });

    return { ok: true, matched: true };
  }

  private async handleSubscriptionChargeFailed(data: Record<string, unknown>) {
    const subscriptionId = String(data.subscription_id || data.id || '');
    if (!subscriptionId) return { ok: true, matched: false };

    const sub = await this.subscriptionRepository.findOne({
      where: { providerSubscriptionId: subscriptionId },
      relations: { user: true },
    });

    if (!sub) return { ok: true, matched: false };

    sub.status = 'past_due';
    await this.subscriptionRepository.save(sub);
    await this.userRepository.update(sub.user.id, { billingStatus: 'past_due' });

    return { ok: true, matched: true };
  }

  private async handleSubscriptionCancel(data: Record<string, unknown>) {
    const subscriptionId = String(data.id || '');
    if (!subscriptionId) return { ok: true, matched: false };

    const sub = await this.subscriptionRepository.findOne({
      where: { providerSubscriptionId: subscriptionId },
      relations: { user: true },
    });

    if (!sub) return { ok: true, matched: false };

    sub.status = 'canceled';
    await this.subscriptionRepository.save(sub);
    await this.userRepository.update(sub.user.id, {
      billingStatus: 'canceled',
      billingPlan: null,
      billingCurrency: null,
      billingPeriodEnd: null,
      billingCancelAtPeriodEnd: false,
    });

    return { ok: true, matched: true };
  }

  private async ensureCulqiCustomer(user: User, secretKey: string): Promise<string> {
    // Reuse existing customer if stored
    if (user.billingCustomerId) {
      return user.billingCustomerId;
    }

    const body = {
      first_name: (user.fullName || user.companyName || user.email).split(' ')[0] || 'Cliente',
      last_name: this.extractLastName(user.fullName || user.companyName || user.email),
      email: user.email,
      address: 'Lima',
      address_city: 'Lima',
      country_code: 'PE',
      phone_number: '51999999999',
    };

    const customer = await this.culqiRequest('/customers', 'POST', body, secretKey);
    const customerId = String(customer.id);

    await this.userRepository.update(user.id, { billingCustomerId: customerId });
    user.billingCustomerId = customerId;

    return customerId;
  }

  private async createCulqiCard(customerId: string, token: string, secretKey: string): Promise<string> {
    const card = await this.culqiRequest('/cards', 'POST', { customer_id: customerId, token_id: token }, secretKey);
    return String(card.id);
  }

  private async createCulqiSubscription(
    customerId: string,
    cardId: string,
    planId: string,
    secretKey: string,
  ): Promise<Record<string, unknown>> {
    const subscription = await this.culqiRequest('/subscriptions', 'POST', {
      plan_id: planId,
      customer_id: customerId,
      card_id: cardId,
      metadata: {},
    }, secretKey);
    return subscription;
  }

  private async upsertBillingFromSubscription(
    user: User,
    planCode: BillingPlanCode,
    currency: BillingCurrency,
    subscription: Record<string, unknown>,
    status: BillingStatus,
  ) {
    const subscriptionId = String(subscription.id);
    const customerId = String(subscription.customer_id || user.billingCustomerId || '');
    const cardId = String(subscription.card_id || '');
    const planId = String(subscription.plan_id || '');

    const nextPeriodEnd = status === 'active' ? this.computeNextPeriodEnd(planCode) : null;

    const existing = await this.subscriptionRepository.findOne({
      where: { providerSubscriptionId: subscriptionId },
    });

    const record = existing || this.subscriptionRepository.create({ user, provider: BILLING_PROVIDER, plan: planCode, currency });

    record.user = user;
    record.plan = planCode;
    record.currency = currency;
    record.status = status;
    record.providerPlanId = planId;
    record.providerCustomerId = customerId;
    record.providerSubscriptionId = subscriptionId;
    record.providerCardId = cardId;
    record.providerTokenId = null;
    record.currentPeriodEnd = nextPeriodEnd;
    record.metadata = subscription;

    await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(BillingSubscription, record);
      const userUpdate = {
        billingStatus: saved.status,
        billingPlan: saved.status === 'canceled' ? null : planCode,
        billingCurrency: saved.status === 'canceled' ? null : currency,
        billingPeriodEnd: saved.currentPeriodEnd,
        billingCustomerId: customerId,
        billingSubscriptionId: subscriptionId,
        billingProvider: BILLING_PROVIDER,
      };
      Object.assign(user, userUpdate);
      await manager.update(User, user.id, userUpdate);
    });
  }

  private computeNextPeriodEnd(planCode: BillingPlanCode): Date {
    const d = new Date();
    if (planCode === 'annual') {
      d.setFullYear(d.getFullYear() + 1);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    return d;
  }

  private extractLastName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : fullName.trim();
  }

  private getCulqiSecretKey(): string {
    const key = this.configService.get<string>('CULQI_SECRET_KEY', '').trim();
    if (!key) throw new BadRequestException('Falta configurar CULQI_SECRET_KEY');
    return key;
  }

  private async culqiRequest(
    path: string,
    method: 'GET' | 'POST' | 'DELETE' | 'PATCH',
    body?: Record<string, unknown>,
    secretKey?: string,
  ): Promise<Record<string, unknown>> {
    const key = secretKey || this.getCulqiSecretKey();
    const timeoutMs = 12000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${CULQI_API_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const json = await res.json() as Record<string, unknown>;

      if (!res.ok) {
        const msg = String(json.merchant_message || json.user_message || json.message || `Culqi HTTP ${res.status}`);
        throw new BadRequestException(msg);
      }

      return json;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ServiceUnavailableException(`Culqi no respondió a tiempo (${timeoutMs}ms)`);
      }
      throw new ServiceUnavailableException('No se pudo conectar con Culqi');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async resolvePlan(planCode: BillingPlanCode, currency: BillingCurrency) {
    const plans = await this.listPlans();
    const plan = plans.find((p) => p.code === planCode && p.currency === currency);
    if (!plan) throw new NotFoundException(`No existe el plan ${planCode} en ${currency}`);
    return plan;
  }

  private async getUserOrThrow(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Sesión inválida');
    return user;
  }

  private serializeBillingState(user: User): BillingState {
    return {
      status: user.billingStatus,
      plan: user.billingPlan,
      provider: user.billingProvider as BillingState['provider'],
      currency: user.billingCurrency,
      currentPeriodEnd: user.billingPeriodEnd ? user.billingPeriodEnd.toISOString() : null,
      customerId: user.billingCustomerId,
      subscriptionId: user.billingSubscriptionId,
      cancelAtPeriodEnd: user.billingCancelAtPeriodEnd ?? false,
    };
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
