import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Index } from 'typeorm';
import { User } from './user.entity';

@Index('IDX_sessions_token_hash', ['tokenHash'], { unique: true })
@Index('IDX_sessions_expires_at', ['expiresAt'])
@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  tokenHash!: string;

  @Column({ type: 'timestamp with time zone' })
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => User, (user) => user.sessions, { onDelete: 'CASCADE', eager: true })
  user!: User;
}
