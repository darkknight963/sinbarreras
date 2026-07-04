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
import * as crypto from 'crypto';

const CULQI_API_BASE = 'https://api.culqi.com/v2';

// CulqiOnline exige body encriptado RSA solo en /plans y /subscriptions
// (JSON plano devuelve 401 "Ruta inválida"). /customers y /cards van en JSON
// plano: no soportan payload encriptado y responden 500 si se les envía.
const CULQI_RSA_PATHS = ['/plans', '/subscriptions'];

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
    // Reutilizar solo si es un customer de Culqi (cus_...). Los usuarios migrados
    // desde Mercado Pago tienen IDs numéricos residuales que Culqi no reconoce.
    if (user.billingCustomerId && user.billingCustomerId.startsWith('cus_')) {
      console.log('[Culqi] ensureCulqiCustomer reusing existing customerId:', user.billingCustomerId);
      return user.billingCustomerId;
    }
    if (user.billingCustomerId) {
      console.log('[Culqi] ensureCulqiCustomer descartando customerId ajeno a Culqi:', user.billingCustomerId);
    }

    const displayName = user.fullName || user.companyName || user.email;
    const nameParts = displayName.trim().split(/\s+/);
    const body = {
      first_name: nameParts[0] || 'Cliente',
      last_name: nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0] || 'Cliente',
      email: user.email,
      address: 'Av. Principal 123',
      address_city: 'Lima',
      country_code: 'PE',
      phone_number: '51900000001',
    };

    console.log('[Culqi] ensureCulqiCustomer creating new customer for email:', user.email);
    const customer = await this.culqiRequest('/customers', 'POST', body, secretKey);
    const customerId = String(customer.id);
    console.log('[Culqi] ensureCulqiCustomer created customerId:', customerId);

    await this.userRepository.update(user.id, { billingCustomerId: customerId });
    user.billingCustomerId = customerId;

    return customerId;
  }

  private async createCulqiCard(customerId: string, token: string, secretKey: string): Promise<string> {
    const payload = { customer_id: customerId, token_id: token };
    console.log('[Culqi] createCulqiCard payload:', JSON.stringify(payload), 'key prefix:', secretKey.slice(0, 12));
    const card = await this.culqiRequest('/cards', 'POST', payload, secretKey);
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

  private getRsaKeyId(): string {
    return this.configService.get<string>('CULQI_RSA_KEY_ID', '').trim();
  }

  private getRsaPublicKey(): string {
    return this.normalizeRsaKey(this.configService.get<string>('CULQI_RSA_PUBLIC_KEY', '') || '');
  }

  private needsRsa(path: string, method: string): boolean {
    if (method === 'GET' || method === 'DELETE') return false;
    if (!this.getRsaPublicKey() || !this.getRsaKeyId()) return false;
    return CULQI_RSA_PATHS.some((p) => path.startsWith(p));
  }

  // Encriptación híbrida RSA-AES exigida por CulqiOnline cuando hay una RSA Key
  // activa en el panel (Desarrollo → RSA Keys). Formato del SDK oficial:
  // 1. AES-256-GCM con key de 32 bytes e IV de 16 bytes aleatorios.
  // 2. encrypted_data = base64(ciphertext || authTag): GCM requiere el tag para
  //    desencriptar, va anexado al final del ciphertext (formato openssl).
  // 3. Key e IV se encriptan por separado con RSA-OAEP (SHA-256 + MGF1).
  // 4. Body final: { encrypted_data, encrypted_key, encrypted_iv } en base64,
  //    más el header x-culqi-rsa-id con el ID de la llave.
  private encryptWithRsa(plaintext: string): string {
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const dataWithTag = Buffer.concat([ciphertext, cipher.getAuthTag()]);

    const oaepOptions = {
      key: this.getRsaPublicKey(),
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    } as const;

    return JSON.stringify({
      encrypted_data: dataWithTag.toString('base64'),
      encrypted_key: crypto.publicEncrypt(oaepOptions, aesKey).toString('base64'),
      encrypted_iv: crypto.publicEncrypt(oaepOptions, iv).toString('base64'),
    });
  }

  // Reconstruye el PEM desde el base64 puro. Tolera comillas envolventes,
  // \n literales y CRLF — cualquier variante en que Railway entregue la env var.
  private normalizeRsaKey(raw: string): string {
    let key = raw.trim();
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
      key = key.slice(1, -1);
    }
    key = key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();

    const b64 = key
      .replace(/-----BEGIN PUBLIC KEY-----/, '')
      .replace(/-----END PUBLIC KEY-----/, '')
      .replace(/\s+/g, '');

    if (!b64) return '';

    const lines = b64.match(/.{1,64}/g) ?? [];
    return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
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

    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    };

    let payload = body ? JSON.stringify(body) : undefined;
    if (payload && this.needsRsa(path, method)) {
      payload = this.encryptWithRsa(payload);
      headers['x-culqi-rsa-id'] = this.getRsaKeyId();
    }

    try {
      const res = await fetch(`${CULQI_API_BASE}${path}`, {
        method,
        headers,
        body: payload,
        signal: controller.signal,
      });

      const json = await res.json() as Record<string, unknown>;

      if (!res.ok) {
        console.error(`[Culqi] ${method} ${path} → ${res.status}`, JSON.stringify(json));
        const msg = String(json.merchant_message || json.user_message || json.message || `Culqi HTTP ${res.status}`);
        throw new BadRequestException(msg);
      }

      console.log(`[Culqi] ${method} ${path} → ${res.status} id=${json.id || '?'}`);
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
