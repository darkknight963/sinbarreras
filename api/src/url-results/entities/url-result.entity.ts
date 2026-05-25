import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Scan } from '../../scans/entities/scan.entity';

@Entity('url_results')
export class UrlResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  url!: string;

  @Column({ type: 'int', nullable: true })
  score!: number;

  @Column({ type: 'jsonb', nullable: true })
  violations!: any; // JSON representation of WCAG violations

  @Column({ type: 'jsonb', nullable: true })
  manualVerifications!: any; // manual reviews checklist state

  @Column({ default: 'completed' }) // pending, scanning, completed, failed
  status!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Scan, (scan) => scan.urlResults, { onDelete: 'CASCADE' })
  scan!: Scan;
}
