import { IsIn, IsOptional, IsString } from 'class-validator';
import type { BillingCurrency, BillingPlanCode } from '../billing.types';

export class CreateCheckoutSessionDto {
  @IsString()
  @IsIn(['monthly', 'annual'])
  planCode!: BillingPlanCode;

  @IsString()
  @IsIn(['PEN', 'USD'])
  currency!: BillingCurrency;

  @IsOptional()
  @IsString()
  returnUrl?: string;
}
