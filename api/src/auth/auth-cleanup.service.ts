import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { User } from './entities/user.entity';
import { Session } from './entities/session.entity';

const GUEST_TTL_DAYS = 1;
const CLEANUP_REPEAT_MS = 60 * 60 * 1000; // cada hora

@Injectable()
export class AuthCleanupScheduler implements OnModuleInit {
  private readonly logger = new Logger(AuthCleanupScheduler.name);

  constructor(
    @InjectQueue('auth-maintenance')
    private readonly authQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.authQueue.add(
      'cleanup-expired',
      {},
      {
        repeat: { every: CLEANUP_REPEAT_MS },
        jobId: 'auth-cleanup-repeatable',
        removeOnComplete: true,
        removeOnFail: 5,
      },
    );
    this.logger.log('Auth cleanup job scheduled (every 1h)');
  }
}

@Processor('auth-maintenance')
export class AuthCleanupWorker extends WorkerHost {
  private readonly logger = new Logger(AuthCleanupWorker.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'cleanup-expired') return;

    const now = new Date();

    // 1. Eliminar sesiones expiradas
    const sessionsResult = await this.sessionRepository
      .createQueryBuilder()
      .delete()
      .where('"expiresAt" < :now', { now })
      .execute();

    // 2. Eliminar guest users sin sesión activa creados hace más de GUEST_TTL_DAYS días
    const guestCutoff = new Date(now.getTime() - GUEST_TTL_DAYS * 24 * 60 * 60 * 1000);
    const guestsResult = await this.userRepository
      .createQueryBuilder('user')
      .delete()
      .where('user.role = :role', { role: 'guest' })
      .andWhere('user."createdAt" < :cutoff', { cutoff: guestCutoff })
      // Solo eliminar si no tienen sesiones activas (las expiradas ya se borraron arriba)
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
