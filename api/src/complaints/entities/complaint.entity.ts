import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type ComplaintType = 'reclamo' | 'queja';
export type ComplaintStatus = 'open' | 'in_review' | 'resolved' | 'closed';

@Entity('complaints')
export class Complaint {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  fullName!: string;

  @Column({ type: 'varchar', length: 40 })
  document!: string;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ type: 'varchar', length: 40 })
  phone!: string;

  @Column({ type: 'varchar', length: 16 })
  type!: ComplaintType;

  @Column({ type: 'varchar', length: 180 })
  service!: string;

  @Column({ type: 'text' })
  detail!: string;

  @Column({ type: 'text' })
  request!: string;

  @Column({ type: 'varchar', length: 24, default: 'open' })
  status!: ComplaintStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
