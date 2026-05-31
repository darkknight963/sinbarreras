import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, Index } from 'typeorm';
import { Scan } from '../../scans/entities/scan.entity';

@Index('IDX_projects_created_at', ['createdAt'])
@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  domain!: string;

  @Column({ type: 'int', default: 4 }) // Default Vo = Media (4)
  vo!: number;

  @Column({ default: 'Sector privado' }) // Tipo entidad
  entityType!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => Scan, (scan) => scan.project)
  scans!: Scan[];
}
