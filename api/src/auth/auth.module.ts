import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthCleanupScheduler, AuthCleanupWorker } from './auth-cleanup.service';
import { User } from './entities/user.entity';
import { Session } from './entities/session.entity';
import { RequestRateLimitService } from '../security/request-rate-limit.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Session]),
    BullModule.registerQueue({ name: 'auth-maintenance' }),
  ],
  controllers: [AuthController],
  providers: [AuthService, RequestRateLimitService, AuthCleanupScheduler, AuthCleanupWorker],
  exports: [AuthService],
})
export class AuthModule {}
