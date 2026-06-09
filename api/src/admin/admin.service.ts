import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { User } from '../auth/entities/user.entity';
import { Session } from '../auth/entities/session.entity';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { CreateAdminUserDto, ResetAdminUserPasswordDto, UpdateAdminUserDto } from './dto/admin-user.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(AdminAuditLog)
    private readonly auditLogRepository: Repository<AdminAuditLog>,
    private readonly authService: AuthService,
  ) {}

  async listUsers() {
    const users = await this.userRepository.find({
      order: { createdAt: 'DESC' },
    });

    return users.map((user) => this.serializeUser(user));
  }

  async createUser(actor: { id: string; email: string }, dto: CreateAdminUserDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      throw new BadRequestException('Ya existe un usuario con ese correo');
    }

    const user = this.userRepository.create({
      email,
      passwordHash: this.authService.hashPassword(dto.password),
      fullName: dto.fullName?.trim() || null,
      companyName: dto.companyName?.trim() || null,
      role: dto.role || 'viewer',
      isActive: true,
      billingStatus: dto.billingStatus || 'inactive',
      billingPlan: dto.billingPlan || null,
      billingProvider: 'culqi',
      billingCurrency: null,
      billingPeriodEnd: null,
      billingCustomerId: null,
      billingSubscriptionId: null,
    });

    const savedUser = await this.userRepository.save(user);
    await this.writeAudit(actor, 'user.create', 'user', savedUser.id, {
      email: savedUser.email,
      role: savedUser.role,
    });

    return this.serializeUser(savedUser);
  }

  async updateUser(actor: { id: string; email: string }, id: string, dto: UpdateAdminUserDto) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (dto.email) {
      const normalizedEmail = dto.email.toLowerCase().trim();
      if (normalizedEmail !== user.email) {
        const existing = await this.userRepository.findOne({ where: { email: normalizedEmail } });
        if (existing && existing.id !== user.id) {
          throw new BadRequestException('Ya existe un usuario con ese correo');
        }
        user.email = normalizedEmail;
      }
    }

    if (typeof dto.fullName === 'string') {
      user.fullName = dto.fullName.trim() || null;
    }

    if (typeof dto.companyName === 'string') {
      user.companyName = dto.companyName.trim() || null;
    }

    if (dto.role) {
      user.role = dto.role;
    }

    if (typeof dto.isActive === 'boolean') {
      user.isActive = dto.isActive;
      if (!dto.isActive) {
        await this.revokeUserSessions(user.id);
      }
    }

    if (dto.billingStatus) {
      user.billingStatus = dto.billingStatus;
    }

    if (dto.billingPlan !== undefined) {
      user.billingPlan = dto.billingPlan;
    }

    const savedUser = await this.userRepository.save(user);
    await this.writeAudit(actor, 'user.update', 'user', savedUser.id, {
      email: savedUser.email,
      role: savedUser.role,
      isActive: savedUser.isActive,
    });

    return this.serializeUser(savedUser);
  }

  async resetPassword(actor: { id: string; email: string }, id: string, dto: ResetAdminUserPasswordDto) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    user.passwordHash = this.authService.hashPassword(dto.password);
    const savedUser = await this.userRepository.save(user);
    await this.revokeUserSessions(savedUser.id);
    await this.writeAudit(actor, 'user.reset_password', 'user', savedUser.id, {
      email: savedUser.email,
    });

    return { ok: true };
  }

  async setActiveState(actor: { id: string; email: string }, id: string, isActive: boolean) {
    return this.updateUser(actor, id, { isActive });
  }

  async listLogs() {
    const logs = await this.auditLogRepository.find({
      order: { createdAt: 'DESC' },
      take: 100,
    });

    return logs;
  }

  private async revokeUserSessions(userId: string) {
    await this.sessionRepository.createQueryBuilder().delete().from(Session).where('userId = :userId', { userId }).execute();
  }

  async writeAudit(
    actor: { id: string; email: string },
    action: string,
    targetType: string,
    targetId: string | null,
    metadata: Record<string, unknown> | null = null,
  ) {
    const entry = this.auditLogRepository.create({
      actorId: actor.id,
      actorEmail: actor.email,
      action,
      targetType,
      targetId,
      metadata,
    });

    await this.auditLogRepository.save(entry);
  }

  private serializeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      companyName: user.companyName,
      role: user.role,
      isActive: user.isActive,
      billingStatus: user.billingStatus,
      billingPlan: user.billingPlan,
      billingProvider: user.billingProvider,
      billingCurrency: user.billingCurrency,
      billingPeriodEnd: user.billingPeriodEnd ? user.billingPeriodEnd.toISOString() : null,
      createdAt: user.createdAt,
    };
  }
}
