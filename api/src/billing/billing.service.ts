import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
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
import { CulqiClient } from './culqi.client';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { ConfirmSubscriptionDto } from './dto/confirm-subscription.dto';
import { CulqiWebhookDto } from './dto/culqi-webhook.dto';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(BillingSubscription)
    private readonly subscriptionRepository: Repository<BillingSubscription>,
    private readonly configService: ConfigService,
    private readonly culqiClient: CulqiClient,
    private readonly dataSource: DataSource,
  ) {}

  async listPlans(): Promise<BillingPlan[]> {
    return Promise.all(BILLING_PLAN_CONFIGS.map((plan) => this.resolveBillingPlan(plan)));
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

    return {
      publicKey: this.culqiClient.getPublicKey(),
      plan,
      amount: plan.amount,
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
    if (!plan.providerPlanId) {
      throw new BadRequestException(`No existe el plan Culqi configurado para ${plan.label} en ${plan.currency}`);
    }

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

    const customerPayload = this.buildCustomerPayload(user);
    const customer = await this.culqiClient.createCustomer(customerPayload);
    const card = await this.culqiClient.createCard({
      customer_id: customer?.id,
      token_id: dto.tokenId,
    });
    const subscription = await this.culqiClient.createSubscription({
      card_id: card?.id,
      plan_id: plan.providerPlanId,
      tyc: true,
      metadata: {
        user_id: user.id,
        email: user.email,
        company_name: user.companyName || '',
        plan_code: plan.code,
        currency: plan.currency,
      },
    });

    const billingStatus = this.mapStatusFromCulqi(subscription?.status ?? 'pending');
    const billingRecord = this.subscriptionRepository.create({
      user,
      provider: BILLING_PROVIDER,
      plan: plan.code,
      currency: plan.currency,
      status: billingStatus,
      providerPlanId: plan.providerPlanId,
      providerCustomerId: customer?.id || null,
      providerSubscriptionId: subscription?.id || null,
      providerCardId: card?.id || null,
      providerTokenId: dto.tokenId,
      currentPeriodEnd: this.mapPeriodEnd(subscription?.next_billing_date),
      metadata: { customer, card, subscription },
    });

    // Transacción: subscription + user billing se guardan juntos o ninguno.
    // Evita el caso donde la subscription se guarda pero el usuario no queda en plan activo.
    await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(BillingSubscription, billingRecord);
      await manager.update(User, user.id, {
        billingStatus: saved.status,
        billingPlan: plan.code,
        billingCurrency: plan.currency,
        billingPeriodEnd: saved.currentPeriodEnd,
        billingCustomerId: saved.providerCustomerId,
        billingSubscriptionId: saved.providerSubscriptionId,
      });
    });

    return this.serializeBillingState(await this.getUserOrThrow(userId));
  }

  async cancelSubscription(userId: string) {
    const user = await this.getUserOrThrow(userId);
    const activeSubscription = await this.subscriptionRepository.findOne({
      where: { user: { id: user.id }, status: 'active' },
      order: { createdAt: 'DESC' },
    });

    // Primero escribimos en DB — la DB es la fuente de verdad para acceso del usuario.
    // Si Culqi falla después, el usuario pierde acceso localmente (correcto: no debe
    // seguir con servicio activo si quiso cancelar) y el equipo puede reintentar la
    // cancelación en Culqi manualmente. Esto evita que Culqi siga cobrando si la
    // BD ya marcó cancelled pero Culqi no fue notificado.
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

    // Luego notificamos a Culqi. Si falla, queda registrado para seguimiento manual.
    if (activeSubscription?.providerSubscriptionId) {
      try {
        await this.culqiClient.cancelSubscription(activeSubscription.providerSubscriptionId);
      } catch (culqiErr) {
        // Log crítico: la subscripción debe cancelarse en Culqi para evitar cobros futuros.
        // El equipo debe revisar y cancelar manualmente en el panel de Culqi.
        console.error(
          `[BILLING CRITICAL] cancelSubscription en Culqi falló para usuario ${userId} ` +
          `(subscriptionId: ${activeSubscription.providerSubscriptionId}). ` +
          `Cancelar manualmente en el panel de Culqi para evitar cobros. Error:`,
          culqiErr,
        );
      }
    }

    return this.serializeBillingState(await this.getUserOrThrow(userId));
  }

  async handleWebhook(payload: CulqiWebhookDto | Record<string, unknown>) {
    const eventName = String(payload.event || payload.type || '');
    const subscriptionId = this.extractSubscriptionId(payload);
    const customerEmail = this.extractCustomerEmail(payload);

    const supportedEvents = [
      'subscription.creation.succeeded',
      'subscription.creation.failed',
      'subscription.charge.succeeded',
      'subscription.charge.failed',
      'subscription.cancel.succeeded',
      'subscription.cancel.failed',
      'charge.succeeded',
      'charge.failed',
    ];

    if (!supportedEvents.some((supportedEvent) => eventName === supportedEvent || eventName.startsWith('subscription.'))) {
      return { ok: true, ignored: true };
    }

    const billingRecord = await this.findBillingRecord(subscriptionId, customerEmail);
    if (!billingRecord) {
      return { ok: true, matched: false };
    }

    billingRecord.status = this.mapStatusFromEvent(eventName, billingRecord.status);
    billingRecord.currentPeriodEnd = this.mapPeriodEnd(this.extractPeriodEnd(payload));

    await this.dataSource.transaction(async (manager) => {
      await manager.save(BillingSubscription, billingRecord);
      await manager.update(User, billingRecord.user.id, {
        billingStatus: billingRecord.status,
        billingPlan: billingRecord.plan,
        billingCurrency: billingRecord.currency,
        billingPeriodEnd: billingRecord.currentPeriodEnd,
        billingCustomerId: billingRecord.providerCustomerId,
        billingSubscriptionId: billingRecord.providerSubscriptionId,
      });
    });

    return { ok: true, matched: true };
  }

  getWebhookSecret(): string {
    return this.configService.get<string>('CULQI_WEBHOOK_SECRET', '').trim();
  }

  private async resolvePlan(planCode: BillingPlanCode, currency: BillingCurrency) {
    const plan = (await this.listPlans()).find((item) => item.code === planCode && item.currency === currency);
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

  private buildCustomerPayload(user: User) {
    const [firstName, ...rest] = (user.fullName || user.companyName || user.email).split(' ');
    const lastName = rest.length > 0 ? rest.join(' ') : user.companyName || 'Cliente';
    return {
      first_name: firstName || 'Cliente',
      last_name: lastName,
      email: user.email,
      address: user.companyName || 'Lima',
      address_city: 'Lima',
      country_code: 'PE',
      phone_number: '999999999',
      metadata: {
        user_id: user.id,
        company_name: user.companyName || '',
      },
    };
  }

  private async resolveBillingPlan(plan: (typeof BILLING_PLAN_CONFIGS)[number]): Promise<BillingPlan> {
    const providerPlanId = this.getConfigValue([plan.providerPlanIdEnv, ...this.getPlanIdAliases(plan)]) || null;
    const configuredAmount = this.resolveAmountFromConfig(plan);
    const amount = configuredAmount ?? (providerPlanId ? await this.resolveAmountFromCulqi(providerPlanId) : null);

    return {
      ...plan,
      provider: BILLING_PROVIDER,
      providerPlanId,
      amount,
      available: Boolean(providerPlanId && amount),
    };
  }

  private getConfigValue(keys: string[]) {
    for (const key of keys) {
      const value = this.configService.get<string>(key, '')?.trim();
      if (value) return value;
    }
    return '';
  }

  private getPlanIdAliases(plan: (typeof BILLING_PLAN_CONFIGS)[number]) {
    if (plan.currency === 'PEN') {
      return plan.code === 'monthly'
        ? ['CULQI_MONTHLY_PLAN_ID']
        : ['CULQI_ANNUAL_PLAN_ID'];
    }
    return [];
  }

  private getAmountAliases(plan: (typeof BILLING_PLAN_CONFIGS)[number]) {
    if (plan.currency === 'PEN') {
      return plan.code === 'monthly'
        ? ['CULQI_MONTHLY_AMOUNT']
        : ['CULQI_ANNUAL_AMOUNT'];
    }
    return [];
  }

  private resolveAmountFromConfig(plan: (typeof BILLING_PLAN_CONFIGS)[number]) {
    const rawValue = this.getConfigValue([plan.amountEnv, ...this.getAmountAliases(plan)]);
    return this.parseAmount(rawValue);
  }

  private async resolveAmountFromCulqi(providerPlanId: string) {
    try {
      const plan = await this.culqiClient.getPlan(providerPlanId);
      return this.parseAmount((plan as { amount?: unknown })?.amount);
    } catch {
      return null;
    }
  }

  private parseAmount(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
  }

  private mapStatusFromCulqi(status: unknown): BillingStatus {
    if (status === 'active' || status === 3 || status === '1') return 'active';
    if (status === 'canceled' || status === 6) return 'canceled';
    if (status === 'past_due' || status === 5) return 'past_due';
    return 'pending';
  }

  private mapStatusFromEvent(eventName: string, current: BillingStatus): BillingStatus {
    if (eventName.includes('cancel.succeeded')) return 'canceled';
    if (eventName.includes('charge.failed')) return 'past_due';
    if (eventName.includes('creation.succeeded') || eventName.includes('charge.succeeded')) return 'active';
    if (current === 'active') return current;
    return current;
  }

  private mapPeriodEnd(value: unknown) {
    if (!value) return null;
    const numeric = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
    if (!Number.isFinite(numeric)) return null;
    return new Date(numeric > 1_000_000_000_000 ? numeric : numeric * 1000);
  }

  private extractSubscriptionId(payload: CulqiWebhookDto | Record<string, unknown>) {
    const data = (payload.data as Record<string, unknown> | undefined) || payload;
    const webhookData = data as Record<string, any>;
    const candidates = [payload.id, webhookData.id, webhookData.subscription_id, webhookData.subscriptionId, webhookData.object];
    const found = candidates.find((value) => typeof value === 'string' && value.startsWith('sxn_'));
    return typeof found === 'string' ? found : null;
  }

  private extractCustomerEmail(payload: CulqiWebhookDto | Record<string, unknown>) {
    const data = (payload.data as Record<string, unknown> | undefined) || payload;
    const webhookData = data as Record<string, any>;
    const customer = (webhookData.customer as Record<string, unknown> | undefined) || payload.customer;
    const email = customer && typeof (customer as Record<string, any>).email === 'string'
      ? (customer as Record<string, any>).email
      : null;
    return email;
  }

  private extractPeriodEnd(payload: CulqiWebhookDto | Record<string, unknown>) {
    const data = (payload.data as Record<string, unknown> | undefined) || payload;
    const webhookData = data as Record<string, any>;
    return webhookData.next_billing_date || webhookData.period_end || webhookData.current_period_end || null;
  }

  private async findBillingRecord(subscriptionId: string | null, customerEmail: string | null) {
    if (subscriptionId) {
      const bySubscription = await this.subscriptionRepository.findOne({
        where: { providerSubscriptionId: subscriptionId },
        relations: { user: true },
      });
      if (bySubscription) return bySubscription;
    }

    if (customerEmail) {
      return this.subscriptionRepository
        .createQueryBuilder('subscription')
        .leftJoinAndSelect('subscription.user', 'user')
        .where('LOWER(user.email) = LOWER(:email)', { email: customerEmail })
        .orderBy('subscription.createdAt', 'DESC')
        .getOne();
    }

    return null;
  }
}
