import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { BillingSubscription } from './entities/billing-subscription.entity';

@Injectable()
export class BillingExpiryService {
  private readonly logger = new Logger(BillingExpiryService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(BillingSubscription)
    private readonly subscriptionRepository: Repository<BillingSubscription>,
  ) {}

  // Margen de gracia para el caso 3 y el barrido de usuarios: cubre reintentos
  // de cobro de Culqi (varios días) y webhooks de renovación que llegan tarde.
  private static readonly GRACE_MS = 3 * 24 * 60 * 60 * 1000;

  // Corre cada hora. Revoca acceso a usuarios cuyo período venció.
  @Cron(CronExpression.EVERY_HOUR)
  async revokeExpiredSubscriptions() {
    const now = new Date();
    const graceCutoff = new Date(now.getTime() - BillingExpiryService.GRACE_MS);

    // Caso 1: cancelAtPeriodEnd=true y currentPeriodEnd ya pasó
    const expiredCanceled = await this.subscriptionRepository.find({
      where: {
        status: 'active',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: LessThan(now),
      },
      relations: { user: true },
    });

    // Caso 2: status=past_due y currentPeriodEnd ya pasó (no renovaron)
    const expiredPastDue = await this.subscriptionRepository.find({
      where: {
        status: 'past_due',
        currentPeriodEnd: LessThan(now),
      },
      relations: { user: true },
    });

    // Caso 3 (red de seguridad): suscripción 'active' sin cancelar cuyo período
    // venció hace más del margen de gracia y nunca se renovó. Sin esto, el
    // sistema depende 100% de los webhooks: si charge.failed o cancel nunca
    // llegan, el usuario conserva Pro para siempre.
    const expiredUnrenewed = await this.subscriptionRepository.find({
      where: {
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: LessThan(graceCutoff),
      },
      relations: { user: true },
    });

    const toExpire = [...expiredCanceled, ...expiredPastDue, ...expiredUnrenewed];

    if (toExpire.length > 0) {
      this.logger.log(`[BillingExpiry] Revocando acceso a ${toExpire.length} suscripcion(es) vencidas`);
    }

    for (const sub of toExpire) {
      try {
        sub.status = 'canceled';
        await this.subscriptionRepository.save(sub);

        await this.userRepository.update(sub.user.id, {
          billingStatus: 'canceled',
          billingPlan: null,
          billingCurrency: null,
          billingPeriodEnd: null,
          billingCancelAtPeriodEnd: false,
        });

        this.logger.log(`[BillingExpiry] Usuario ${sub.user.id} (sub ${sub.id}) marcado como cancelado`);
      } catch (err) {
        this.logger.error(`[BillingExpiry] Error al revocar sub ${sub.id}:`, err);
      }
    }

    // Barrido a nivel usuario: cubre activaciones manuales del admin (que no
    // crean fila en billing_subscriptions) y cualquier usuario 'active' cuyo
    // billingPeriodEnd venció hace más del margen de gracia sin renovarse.
    // Las renovaciones legítimas actualizan billingPeriodEnd vía webhook, así
    // que nunca alcanzan este cutoff.
    try {
      const staleUsers = await this.userRepository
        .createQueryBuilder()
        .update(User)
        .set({
          billingStatus: 'canceled',
          billingPlan: null,
          billingCurrency: null,
          billingPeriodEnd: null,
          billingCancelAtPeriodEnd: false,
        })
        .where(`"billingStatus" = 'active'`)
        .andWhere(`"billingPeriodEnd" IS NOT NULL`)
        .andWhere(`"billingPeriodEnd" < :cutoff`, { cutoff: graceCutoff })
        .execute();

      if (staleUsers.affected) {
        this.logger.log(`[BillingExpiry] ${staleUsers.affected} usuario(s) con período vencido sin renovar revocados`);
      }
    } catch (err) {
      this.logger.error('[BillingExpiry] Error en barrido de usuarios vencidos:', err);
    }
  }
}
