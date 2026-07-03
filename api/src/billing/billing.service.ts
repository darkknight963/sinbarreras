import { Injectable, NotFoundException, UnauthorizedException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
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
    const checkoutMode = this.getMercadoPagoCheckoutMode();

    if (checkoutMode === 'payment') {
      return this.createPaymentCheckoutSession(user, plan, accessToken, externalReference, frontendUrl);
    }

    return this.createPreapprovalCheckoutSession(user, plan, accessToken, externalReference, frontendUrl);
  }

  private async createPaymentCheckoutSession(
    user: User,
    plan: BillingPlan,
    accessToken: string,
    externalReference: string,
    frontendUrl: string,
  ) {
    const apiBaseUrl = this.getPublicApiBaseUrl();
    const response = await this.fetchMercadoPagoWithRetry('/checkout/preferences', {
      method: 'POST',
      headers: this.buildMercadoPagoHeaders(accessToken, true),
      body: JSON.stringify({
        external_reference: externalReference,
        back_urls: {
          success: this.buildReturnUrl(frontendUrl, plan, 'success'),
          pending: this.buildReturnUrl(frontendUrl, plan, 'pending'),
          failure: this.buildReturnUrl(frontendUrl, plan, 'failure'),
        },
        auto_return: 'approved',
        notification_url: `${apiBaseUrl}/billing/webhooks/mp`,
        payer: {
          email: user.email,
          name: user.fullName || user.companyName || user.email,
          last_name: this.extractLastName(user.fullName || user.companyName || user.email),
        },
        metadata: {
          userId: user.id,
          planCode: plan.code,
          currency: plan.currency,
          checkoutMode: 'payment',
        },
        items: [
          {
            id: `${plan.code}-${plan.currency}`,
            title: `${plan.label} - ${plan.description}`,
            description: plan.description,
            quantity: 1,
            currency_id: plan.currency,
            unit_price: this.toMercadoPagoAmount(plan.amount || 0),
          },
        ],
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
      preferenceId: payload.id ? String(payload.id) : null,
      preapprovalId: null,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        companyName: user.companyName,
      },
    };
  }

  private async createPreapprovalCheckoutSession(
    user: User,
    plan: BillingPlan,
    accessToken: string,
    externalReference: string,
    frontendUrl: string,
  ) {
    const requestPayload = {
      reason: `Sin Barreras Pro ${plan.label}`.slice(0, 40),
      external_reference: externalReference,
      payer_email: this.resolveMercadoPagoPayerEmail(accessToken, user.email),
      back_url: this.buildReturnUrl(frontendUrl, plan, 'success'),
      notification_url: `${this.getPublicApiBaseUrl()}/billing/webhooks/mp`,
      status: 'pending',
      auto_recurring: {
        frequency: plan.code === 'annual' ? 12 : 1,
        frequency_type: 'months',
        transaction_amount: this.toMercadoPagoAmount(plan.amount || 0),
        currency_id: plan.currency,
      },
    };
    const response = await this.fetchMercadoPagoWithRetry('/preapproval', {
      method: 'POST',
      headers: this.buildMercadoPagoHeaders(accessToken, true),
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      throw new BadRequestException(await this.readMercadoPagoError(response));
    }

    const payload = await response.json() as Record<string, unknown>;
    const preapprovalId = payload.id ? String(payload.id) : null;

    // MP no agrega preapproval_id al back_url automáticamente (a diferencia de payment_id
    // en checkout). Actualizamos el back_url con el ID real para que el frontend pueda
    // confirmar la suscripción al regresar.
    if (preapprovalId) {
      const updatedBackUrl = this.buildReturnUrl(frontendUrl, plan, 'success', preapprovalId);
      await this.fetchMercadoPagoWithRetry(`/preapproval/${preapprovalId}`, {
        method: 'PUT',
        headers: this.buildMercadoPagoHeaders(accessToken, true),
        body: JSON.stringify({ back_url: updatedBackUrl }),
      }).catch((err) => {
        console.warn('[BillingService] No se pudo actualizar back_url del preapproval con ID', preapprovalId, err);
      });
    }

    return {
      plan,
      amount: plan.amount,
      initPoint: String(payload.init_point || ''),
      sandboxInitPoint: String(payload.sandbox_init_point || ''),
      checkoutUrl: String(payload.init_point || payload.sandbox_init_point || ''),
      preapprovalId,
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
      const preapproval = await this.safeGetMercadoPagoPreapproval(dto.preapprovalId);
      if (!preapproval) {
        // MP no reconoce el preapproval (abandonado, expirado o inválido) — tratar como pending
        return this.serializeBillingState(user);
      }
      const subscriptionStatus = String(preapproval.status || '').toLowerCase();
      const billingStatus = this.mapPreapprovalStatus(subscriptionStatus);
      const preapprovalRef = String(preapproval.external_reference || '');
      const parsedPreapprovalRef = preapprovalRef ? this.parseExternalReference(preapprovalRef) : null;
      const resolvedPlanCode = parsedPreapprovalRef?.planCode ?? plan.code;
      const resolvedCurrency = parsedPreapprovalRef?.currency ?? plan.currency;
      await this.upsertBillingFromPreapproval(user, resolvedPlanCode, resolvedCurrency, dto.preapprovalId, preapproval, billingStatus);
      return this.serializeBillingState(await this.getUserOrThrow(user.id));
    }

    if (!dto.paymentId) {
      return this.serializeBillingState(user);
    }

    const payment = await this.safeGetMercadoPagoPayment(dto.paymentId);
    if (!payment) {
      return this.serializeBillingState(user);
    }
    const paymentStatus = String(payment.status || '').toLowerCase();

    // Intentar extraer planCode/currency del external_reference del pago (formato sb|userId|planCode|currency|uuid).
    // Esto es más confiable que los params del back_url que MP puede no preservar.
    const externalRef = String(payment.external_reference || '');
    const parsedRef = externalRef ? this.parseExternalReference(externalRef) : null;
    const resolvedPlanCode = parsedRef?.planCode ?? plan.code;
    const resolvedCurrency = parsedRef?.currency ?? plan.currency;

    // En modo preapproval, collection_id es el ID del pago recurrente, no del preapproval.
    // El pago tiene preapproval_id en su respuesta — lo usamos para activar la suscripción.
    const preapprovalIdFromPayment = payment.preapproval_id
      ? String(payment.preapproval_id)
      : null;

    if (preapprovalIdFromPayment) {
      const preapproval = await this.safeGetMercadoPagoPreapproval(preapprovalIdFromPayment);
      if (preapproval) {
        const subscriptionStatus = String(preapproval.status || '').toLowerCase();
        const billingStatus = this.mapPreapprovalStatus(subscriptionStatus);
        await this.upsertBillingFromPreapproval(user, resolvedPlanCode, resolvedCurrency, preapprovalIdFromPayment, preapproval, billingStatus);
        return this.serializeBillingState(await this.getUserOrThrow(user.id));
      }
    }

    const billingStatus = this.mapPaymentStatus(paymentStatus);
    await this.upsertBillingFromPayment(user, resolvedPlanCode, resolvedCurrency, dto.paymentId, payment, billingStatus);
    return this.serializeBillingState(await this.getUserOrThrow(user.id));
  }

  async adminActivate(userId: string, dto: { planCode: BillingPlanCode; currency: BillingCurrency; paymentId?: string; preapprovalId?: string }) {
    const user = await this.getUserOrThrow(userId);
    const plan = await this.resolvePlan(dto.planCode, dto.currency);

    if (dto.preapprovalId) {
      const preapproval = await this.getMercadoPagoPreapproval(dto.preapprovalId);
      const billingStatus = this.mapPreapprovalStatus(String(preapproval.status || '').toLowerCase());
      await this.upsertBillingFromPreapproval(user, plan.code, plan.currency, dto.preapprovalId, preapproval, billingStatus);
      // Limpiar cancelAtPeriodEnd si fue cancelado por error
      await this.userRepository.update(user.id, { billingCancelAtPeriodEnd: false });
      await this.subscriptionRepository.update({ providerSubscriptionId: dto.preapprovalId }, { cancelAtPeriodEnd: false });
      return this.serializeBillingState(await this.getUserOrThrow(userId));
    }

    if (dto.paymentId) {
      const payment = await this.getMercadoPagoPayment(dto.paymentId);
      const preapprovalIdFromPayment = payment.preapproval_id ? String(payment.preapproval_id) : null;
      if (preapprovalIdFromPayment) {
        const preapproval = await this.getMercadoPagoPreapproval(preapprovalIdFromPayment);
        const billingStatus = this.mapPreapprovalStatus(String(preapproval.status || '').toLowerCase());
        await this.upsertBillingFromPreapproval(user, plan.code, plan.currency, preapprovalIdFromPayment, preapproval, billingStatus);
        await this.userRepository.update(user.id, { billingCancelAtPeriodEnd: false });
        await this.subscriptionRepository.update({ providerSubscriptionId: preapprovalIdFromPayment }, { cancelAtPeriodEnd: false });
        return this.serializeBillingState(await this.getUserOrThrow(userId));
      }
    }

    throw new BadRequestException('Se requiere preapprovalId o paymentId valido');
  }

  async cancelSubscription(userId: string) {
    const user = await this.getUserOrThrow(userId);
    const activeSubscription = await this.subscriptionRepository.findOne({
      where: { user: { id: user.id }, status: 'active' },
      order: { createdAt: 'DESC' },
    });

    // Cancelar en MP primero para detener cobros futuros.
    // Solo aplica a preapprovals (IDs no numéricos); los pagos únicos no se pueden cancelar.
    // Si falla, aun marcamos cancelAtPeriodEnd en BD para que no se renueve.
    const subId = activeSubscription?.providerSubscriptionId;
    const isPreapproval = subId && !/^\d+$/.test(subId);
    if (isPreapproval) {
      try {
        const accessToken = this.getMercadoPagoAccessToken();
        await this.fetchMercadoPagoWithRetry(`/preapproval/${subId}`, {
          method: 'PUT',
          headers: this.buildMercadoPagoHeaders(accessToken, true),
          body: JSON.stringify({ status: 'cancelled' }),
        });
      } catch (err) {
        console.error(
          `[BILLING CRITICAL] cancelSubscription en MP falló para usuario ${userId} ` +
          `(preapprovalId: ${subId}). Cancelar manualmente en MP.`,
          err,
        );
      }
    }

    // Mantener acceso activo hasta currentPeriodEnd — solo marcamos cancelAtPeriodEnd.
    // El acceso se revoca cuando venza el período (el webhook de MP o un job lo actualiza).
    await this.dataSource.transaction(async (manager) => {
      if (activeSubscription) {
        activeSubscription.cancelAtPeriodEnd = true;
        await manager.save(BillingSubscription, activeSubscription);
      }
      await manager.update(User, user.id, {
        billingCancelAtPeriodEnd: true,
      });
    });

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

    // Ignorar tipos de webhook que no son pagos ni preapprovals
    const ignoredTypes = ['topic_merchant_order_wh', 'merchant_order', 'point_integration_wh', 'delivery', 'associate_plan'];
    if (ignoredTypes.some((t) => eventType.toLowerCase().includes(t))) {
      return { ok: true, ignored: true };
    }

    if (this.isPreapprovalWebhook(eventType, payload, resourceId)) {
      const preapproval = await this.safeGetMercadoPagoPreapproval(resourceId);
      if (!preapproval) {
        return { ok: true, matched: false, ignored: true };
      }
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

    const payment = await this.safeGetMercadoPagoPayment(resourceId);
    if (!payment) {
      return { ok: true, matched: false, ignored: true };
    }
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

  private getMercadoPagoCheckoutMode() {
    const mode = this.configService.get<string>('MP_CHECKOUT_MODE', '').trim().toLowerCase();
    return mode === 'preapproval' || mode === 'subscription' ? 'preapproval' : 'payment';
  }

  private extractLastName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : fullName.trim();
  }

  private resolveMercadoPagoPayerEmail(accessToken: string, userEmail: string) {
    if (accessToken.startsWith('TEST-')) {
      const configuredTestEmail = this.configService.get<string>('MP_TEST_PAYER_EMAIL', '').trim();
      if (configuredTestEmail) {
        return configuredTestEmail;
      }
    }

    return userEmail;
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

  private buildReturnUrl(frontendUrl: string, plan: BillingPlan, checkoutStatus: 'success' | 'pending' | 'failure', preapprovalId?: string) {
    const url = new URL(frontendUrl);
    url.searchParams.set('checkout', checkoutStatus);
    url.searchParams.set('plan', plan.code);
    url.searchParams.set('currency', plan.currency);
    if (preapprovalId) {
      url.searchParams.set('preapproval_id', preapprovalId);
    }
    return url.toString();
  }

  private buildExternalReference(userId: string, planCode: BillingPlanCode, currency: BillingCurrency) {
    return `sb|${userId}|${planCode}|${currency}|${randomUUID()}`;
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

  async debugPayment(paymentId: string) {
    const payment = await this.getMercadoPagoPayment(paymentId);
    return {
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      payment_method_id: payment.payment_method_id,
      payment_type_id: payment.payment_type_id,
      date_created: payment.date_created,
      date_last_updated: payment.date_last_updated,
      payer: payment.payer,
      transaction_amount: payment.transaction_amount,
      currency_id: payment.currency_id,
      description: payment.description,
      error_codes: (payment as any).error_codes,
    };
  }

  private async getMercadoPagoPayment(paymentId: string) {
    const accessToken = this.getMercadoPagoAccessToken();
    const response = await this.fetchMercadoPagoWithRetry(`/v1/payments/${paymentId}`, {
      headers: this.buildMercadoPagoHeaders(accessToken),
    });

    if (!response.ok) {
      throw new BadRequestException(await this.readMercadoPagoError(response));
    }

    return await response.json() as Record<string, unknown>;
  }

  private async getMercadoPagoPreapproval(preapprovalId: string) {
    const accessToken = this.getMercadoPagoAccessToken();
    const response = await this.fetchMercadoPagoWithRetry(`/preapproval/${preapprovalId}`, {
      headers: this.buildMercadoPagoHeaders(accessToken),
    });

    if (!response.ok) {
      throw new BadRequestException(await this.readMercadoPagoError(response));
    }

    return await response.json() as Record<string, unknown>;
  }

  private async safeGetMercadoPagoPayment(paymentId: string) {
    try {
      return await this.getMercadoPagoPayment(paymentId);
    } catch (error) {
      console.warn('[BillingService] Ignorando webhook payment sin recurso recuperable', { paymentId, error });
      return null;
    }
  }

  private async safeGetMercadoPagoPreapproval(preapprovalId: string) {
    try {
      return await this.getMercadoPagoPreapproval(preapprovalId);
    } catch (error) {
      console.warn('[BillingService] Ignorando webhook preapproval sin recurso recuperable', { preapprovalId, error });
      return null;
    }
  }

  private async readMercadoPagoError(response: Response) {
    try {
      const body = await response.json() as Record<string, unknown>;
      const cause = Array.isArray(body.cause)
        ? body.cause.map((item) => {
            if (item && typeof item === 'object') {
              const detail = 'description' in item ? item.description : 'message' in item ? item.message : null;
              return detail ? String(detail) : JSON.stringify(item);
            }
            return String(item);
          }).join(' | ')
        : '';
      return String(body.message || body.error || cause || `Mercado Pago HTTP ${response.status}`);
    } catch {
      return `Mercado Pago HTTP ${response.status}`;
    }
  }

  private buildMercadoPagoHeaders(accessToken: string, includeJsonHeaders = false) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    if (includeJsonHeaders) {
      headers['Content-Type'] = 'application/json';
      headers['X-Idempotency-Key'] = randomUUID();
    }

    if (accessToken.startsWith('TEST-')) {
      headers['X-scope'] = 'stage';
    }

    return headers;
  }

  private async fetchMercadoPagoWithRetry(path: string, init: RequestInit, retries = 2) {
    let attempt = 0;
    let response = await this.fetchMercadoPago(path, init);

    while ((response.status === 503 || response.status === 502 || response.status === 504) && attempt < retries) {
      attempt += 1;
      console.warn('[BillingService] Mercado Pago temporalmente no disponible', { path, status: response.status, attempt });
      await this.sleep(350 * attempt);
      response = await this.fetchMercadoPago(path, init);
    }

    return response;
  }

  private async fetchMercadoPago(path: string, init: RequestInit) {
    const timeoutMs = this.getMercadoPagoTimeoutMs();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(`${BillingService.MP_API_BASE_URL}${path}`, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ServiceUnavailableException(`Mercado Pago no respondio a tiempo (${timeoutMs} ms)`);
      }

      throw new ServiceUnavailableException('No se pudo conectar con Mercado Pago');
    } finally {
      clearTimeout(timeout);
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getMercadoPagoTimeoutMs() {
    const configured = this.configService.get<string>('MP_TIMEOUT_MS', '').trim();
    const parsed = Number(configured);
    if (Number.isFinite(parsed) && parsed >= 3000) {
      return parsed;
    }
    return 12000;
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
      cancelAtPeriodEnd: user.billingCancelAtPeriodEnd ?? false,
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
