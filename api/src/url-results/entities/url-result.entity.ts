import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Index } from 'typeorm';
import { Scan } from '../../scans/entities/scan.entity';

@Index('IDX_url_results_scan_created_at', ['scan', 'createdAt'])
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

  @Column({ type: 'jsonb', nullable: true })
  applicability!: any; // WCAG criteria applicability matrix and summary

  @Column({ type: 'jsonb', nullable: true })
  engineReport!: any; // structured per-engine execution summary

  @Column({ type: 'jsonb', nullable: true })
  focusTraversal!: any; // keyboard tab traversal map and visual evidence

  @Column({ type: 'jsonb', nullable: true })
  semanticStructure!: any; // headings, landmarks, forms, tables and reading structure inventory

  @Column({ type: 'jsonb', nullable: true })
  visualMap!: any; // full-page screenshots with positioned accessibility finding markers

  @Column({ default: 'completed' }) // pending, scanning, completed, failed
  status!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Scan, (scan) => scan.urlResults, { onDelete: 'CASCADE' })
  scan!: Scan;
}
