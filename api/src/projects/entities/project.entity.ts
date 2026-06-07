import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, ManyToOne, Index } from 'typeorm';
import { Scan } from '../../scans/entities/scan.entity';
import { User } from '../../auth/entities/user.entity';

@Index('IDX_projects_created_at', ['createdAt'])
@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', nullable: true })
  name!: string;

  @Column({ type: 'text', nullable: true })
  domain!: string;

  @Column({ type: 'int', default: 4 }) // Default Vo = Media (4)
  vo!: number;

  @Column({ type: 'text', default: 'Sector privado' }) // Tipo entidad
  entityType!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => User, (user) => user.projects, { nullable: true, onDelete: 'SET NULL' })
  owner!: User | null;

  @OneToMany(() => Scan, (scan) => scan.project)
  scans!: Scan[];
}
