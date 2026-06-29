import { IsIn, IsString } from 'class-validator';
import type { BillingCurrency, BillingPlanCode } from '../billing.types';

export class ConfirmSubscriptionDto {
  @IsString()
  @IsIn(['monthly', 'annual'])
  planCode!: BillingPlanCode;

  @IsString()
  @IsIn(['PEN', 'USD'])
  currency!: BillingCurrency;

  @IsString()
  paymentId!: string;
}
