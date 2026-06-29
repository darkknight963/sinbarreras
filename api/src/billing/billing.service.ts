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
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { ConfirmSubscriptionDto } from './dto/confirm-subscription.dto';
import { MpWebhookDto } from './dto/mp-webhook.dto';

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

  async createCheckoutSession(userId: string, dto: CreateCheckoutSessionDto) {
    const user = await this.getUserOrThrow(userId);
    const plan = await this.resolvePlan(dto.planCode, dto.currency);
    if (!plan.amount) {
      throw new BadRequestException(`No existe el monto configurado para ${plan.label} en ${plan.currency}`);
    }

    // TODO: crear preferencia en Mercado Pago y devolver init_point o preference_id
    return {
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

    // TODO: verificar pago en Mercado Pago con dto.paymentId antes de activar
    const billingRecord = this.subscriptionRepository.create({
      user,
      provider: BILLING_PROVIDER,
      plan: plan.code,
      currency: plan.currency,
      status: 'pending',
      providerPlanId: null,
      providerCustomerId: null,
      providerSubscriptionId: dto.paymentId || null,
      providerCardId: null,
      providerTokenId: null,
      currentPeriodEnd: null,
      metadata: { paymentId: dto.paymentId },
    });

    await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(BillingSubscription, billingRecord);
      const userUpdate = {
        billingStatus: saved.status,
        billingPlan: plan.code,
        billingCurrency: plan.currency,
        billingPeriodEnd: saved.currentPeriodEnd,
        billingCustomerId: saved.providerCustomerId,
        billingSubscriptionId: saved.providerSubscriptionId,
      };
      Object.assign(user, userUpdate);
      await manager.update(User, user.id, userUpdate);
    });

    return this.serializeBillingState(user);
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
    const paymentId = String(data.id || payload.id || '');

    // TODO: implementar procesamiento de webhooks de Mercado Pago
    // Los eventos principales son: payment, subscription_authorized_payment, subscription_preapproval
    console.log('[BillingService] MP webhook recibido:', { eventType, paymentId });

    if (!eventType) {
      return { ok: true, ignored: true };
    }

    const billingRecord = paymentId
      ? await this.subscriptionRepository.findOne({
          where: { providerSubscriptionId: paymentId },
          relations: { user: true },
        })
      : null;

    if (!billingRecord) {
      return { ok: true, matched: false };
    }

    billingRecord.status = this.mapStatusFromEvent(eventType, billingRecord.status);

    const userUpdate = {
      billingStatus: billingRecord.status,
      billingPlan: billingRecord.plan,
      billingCurrency: billingRecord.currency,
      billingPeriodEnd: billingRecord.currentPeriodEnd,
      billingCustomerId: billingRecord.providerCustomerId,
      billingSubscriptionId: billingRecord.providerSubscriptionId,
    };

    Object.assign(billingRecord.user, userUpdate);

    await this.dataSource.transaction(async (manager) => {
      await manager.save(BillingSubscription, billingRecord);
      await manager.update(User, billingRecord.user.id, userUpdate);
    });

    return { ok: true, matched: true };
  }

  getWebhookSecret(): string {
    return this.configService.get<string>('MP_WEBHOOK_SECRET', '').trim();
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

  private mapStatusFromEvent(eventType: string, current: BillingStatus): BillingStatus {
    if (eventType.includes('cancel') || eventType.includes('refund')) return 'canceled';
    if (eventType.includes('payment') && eventType.includes('approved')) return 'active';
    if (eventType.includes('payment') && eventType.includes('failed')) return 'past_due';
    return current;
  }
}
