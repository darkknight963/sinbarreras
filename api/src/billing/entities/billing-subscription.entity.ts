import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import type { BillingCurrency, BillingPlanCode, BillingProvider, BillingStatus } from '../billing.types';

@Index('IDX_billing_subscriptions_provider_subscription_id', ['providerSubscriptionId'])
@Entity('billing_subscriptions')
export class BillingSubscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  user!: User;

  @Column({ type: 'varchar', length: 32, default: 'mercadopago' })
  provider!: BillingProvider;

  @Column({ type: 'varchar', length: 32 })
  plan!: BillingPlanCode;

  @Column({ type: 'varchar', length: 8 })
  currency!: BillingCurrency;

  @Column({ type: 'varchar', length: 32, default: 'inactive' })
  status!: BillingStatus;

  @Column({ type: 'text', nullable: true })
  providerPlanId!: string | null;

  @Column({ type: 'text', nullable: true })
  providerCustomerId!: string | null;

  @Column({ type: 'text', nullable: true })
  providerSubscriptionId!: string | null;

  @Column({ type: 'text', nullable: true })
  providerCardId!: string | null;

  @Column({ type: 'text', nullable: true })
  providerTokenId!: string | null;

  @Column({ nullable: true, type: 'timestamptz' })
  currentPeriodEnd!: Date | null;

  @Column({ nullable: true, type: 'jsonb' })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
