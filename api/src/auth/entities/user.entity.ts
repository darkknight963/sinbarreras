import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, Index } from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { Session } from './session.entity';
import type { BillingCurrency, BillingPlanCode, BillingProvider, BillingStatus } from '../../billing/billing.types';

@Index('IDX_users_email', ['email'], { unique: true })
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ type: 'text' })
  passwordHash!: string;

  @Column({ type: 'text', nullable: true })
  fullName!: string | null;

  @Column({ type: 'text', nullable: true })
  companyName!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'free' })
  role!: 'free' | 'admin' | 'superadmin' | 'guest';

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 32, default: 'inactive' })
  billingStatus!: BillingStatus;

  @Column({ type: 'varchar', length: 32, nullable: true })
  billingPlan!: BillingPlanCode | null;

  @Column({ type: 'varchar', length: 32, default: 'mercadopago' })
  billingProvider!: BillingProvider;

  @Column({ type: 'varchar', length: 8, nullable: true })
  billingCurrency!: BillingCurrency | null;

  @Column({ nullable: true, type: 'timestamptz' })
  billingPeriodEnd!: Date | null;

  @Column({ type: 'text', nullable: true })
  billingCustomerId!: string | null;

  @Column({ type: 'text', nullable: true })
  billingSubscriptionId!: string | null;

  @Column({ type: 'boolean', default: false })
  billingCancelAtPeriodEnd!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => Session, (session) => session.user)
  sessions!: Session[];

  @OneToMany(() => Project, (project) => project.owner)
  projects!: Project[];
}
