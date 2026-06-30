import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthCleanupService } from './auth-cleanup.service';
import { User } from './entities/user.entity';
import { Session } from './entities/session.entity';
import { RequestRateLimitService } from '../security/request-rate-limit.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Session]),
  ],
  controllers: [AuthController],
  providers: [AuthService, RequestRateLimitService, AuthCleanupService],
  exports: [AuthService],
})
export class AuthModule {}
