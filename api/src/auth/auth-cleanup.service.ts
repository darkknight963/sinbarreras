import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { User } from './entities/user.entity';
import { Session } from './entities/session.entity';

const GUEST_TTL_DAYS = 1;

@Injectable()
export class AuthCleanupService {
  private readonly logger = new Logger(AuthCleanupService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpired() {
    const now = new Date();

    const sessionsResult = await this.sessionRepository
      .createQueryBuilder()
      .delete()
      .where('"expiresAt" < :now', { now })
      .execute();

    const guestCutoff = new Date(now.getTime() - GUEST_TTL_DAYS * 24 * 60 * 60 * 1000);
    const guestsResult = await this.userRepository
      .createQueryBuilder('user')
      .delete()
      .where('user.role = :role', { role: 'guest' })
      .andWhere('user."createdAt" < :cutoff', { cutoff: guestCutoff })
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM sessions s WHERE s."userId" = user.id AND s."expiresAt" > :now)',
        { now },
      )
      .execute();

    this.logger.log(
      `Auth cleanup: ${sessionsResult.affected ?? 0} sesiones expiradas, ${guestsResult.affected ?? 0} guest users eliminados`,
    );
  }
}
