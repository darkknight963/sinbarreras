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

  // Corre cada hora. Revoca acceso a usuarios cuyo período venció.
  @Cron(CronExpression.EVERY_HOUR)
  async revokeExpiredSubscriptions() {
    const now = new Date();

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

    const toExpire = [...expiredCanceled, ...expiredPastDue];

    if (toExpire.length === 0) {
      return;
    }

    this.logger.log(`[BillingExpiry] Revocando acceso a ${toExpire.length} suscripcion(es) vencidas`);

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
  }
}
