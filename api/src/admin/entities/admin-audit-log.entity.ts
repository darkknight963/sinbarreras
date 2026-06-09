import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('admin_audit_logs')
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  actorId!: string | null;

  @Column({ type: 'varchar', length: 320 })
  actorEmail!: string;

  @Column({ type: 'varchar', length: 96 })
  action!: string;

  @Column({ type: 'varchar', length: 64 })
  targetType!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  targetId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;
}
