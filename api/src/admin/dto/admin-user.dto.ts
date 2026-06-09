import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAdminUserDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string;

  @IsOptional()
  @IsIn(['owner', 'admin', 'viewer'])
  role?: 'owner' | 'admin' | 'viewer';

  @IsOptional()
  @IsIn(['inactive', 'pending', 'active', 'past_due', 'canceled'])
  billingStatus?: 'inactive' | 'pending' | 'active' | 'past_due' | 'canceled';

  @IsOptional()
  @IsIn(['monthly', 'annual'])
  billingPlan?: 'monthly' | 'annual';
}

export class UpdateAdminUserDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string;

  @IsOptional()
  @IsIn(['owner', 'admin', 'viewer'])
  role?: 'owner' | 'admin' | 'viewer';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(['inactive', 'pending', 'active', 'past_due', 'canceled'])
  billingStatus?: 'inactive' | 'pending' | 'active' | 'past_due' | 'canceled';

  @IsOptional()
  @IsIn(['monthly', 'annual'])
  billingPlan?: 'monthly' | 'annual' | null;
}

export class ResetAdminUserPasswordDto {
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}
