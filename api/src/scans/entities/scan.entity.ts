import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, Index } from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { UrlResult } from '../../url-results/entities/url-result.entity';

@Index('IDX_scans_status', ['status'])
@Index('IDX_scans_created_at', ['createdAt'])
@Index('IDX_scans_project_created_at', ['project', 'createdAt'])
@Entity('scans')
export class Scan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ default: 'pending' }) // pending, running, completed, failed
  status!: string;

  @Column({ type: 'int', nullable: true })
  globalScore!: number;

  @Column({ type: 'int', default: 4 }) // Default Ux = Media (4)
  ux!: number;

  @Column({ type: 'int', nullable: true })
  vp!: number; // Calculated Vp = Vo * Ux

  @Column({ default: 'estandar' }) // rapido, estandar, profundo
  scanMode!: string;

  @Column({ default: 'none' })
  loginMode!: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  scanUrls!: string[];

  @Column({ default: 'Resolucion N° 001-2025-PCM/SGTD' })
  normativeVersion!: string;

  @Column({ default: 'WCAG 2.2' })
  wcagVersion!: string;

  @Column({ default: '2026-05' })
  ruleSetVersion!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Project, (project) => project.scans, { onDelete: 'CASCADE' })
  project!: Project;

  @OneToMany(() => UrlResult, (result) => result.scan)
  urlResults!: UrlResult[];
}
