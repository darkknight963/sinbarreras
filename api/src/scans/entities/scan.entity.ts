import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { UrlResult } from '../../url-results/entities/url-result.entity';

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

  @Column({ default: 'estándar' }) // rápido, estándar, profundo
  scanMode!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Project, (project) => project.scans, { onDelete: 'CASCADE' })
  project!: Project;

  @OneToMany(() => UrlResult, (result) => result.scan)
  urlResults!: UrlResult[];
}
