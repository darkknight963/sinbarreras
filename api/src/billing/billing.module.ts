import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingSubscription } from './entities/billing-subscription.entity';
import { User } from '../auth/entities/user.entity';
import { CulqiClient } from './culqi.client';

@Module({
  imports: [TypeOrmModule.forFeature([BillingSubscription, User])],
  controllers: [BillingController],
  providers: [BillingService, CulqiClient],
  exports: [BillingService],
})
export class BillingModule {}
