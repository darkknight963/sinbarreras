import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { User } from '../auth/entities/user.entity';
import { Session } from '../auth/entities/session.entity';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { CreateAdminUserDto, ResetAdminUserPasswordDto, UpdateAdminUserDto } from './dto/admin-user.dto';

type AppRole = 'admin' | 'superadmin' | 'guest';
type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

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

  private normalizeRole(role: string | null | undefined): AppRole {
    if (role === 'superadmin') return 'superadmin';
    if (role === 'guest') return 'guest';
    return 'admin';
  }

  private normalizePagination(page: number, pageSize: number) {
    const safePage = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
    const safePageSize = Number.isFinite(pageSize) ? Math.min(50, Math.max(1, Math.trunc(pageSize))) : 10;

    return {
      page: safePage,
      pageSize: safePageSize,
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    };
  }

  async listUsers(page = 1, pageSize = 10): Promise<PaginatedResult<ReturnType<AdminService['serializeUser']>>> {
    const pagination = this.normalizePagination(page, pageSize);
    const [users, total] = await this.userRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: pagination.skip,
      take: pagination.take,
    });

    return {
      items: users.map((user) => this.serializeUser(user)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
    };
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
      role: dto.role || 'admin',
      isActive: true,
      billingStatus: dto.billingStatus || 'inactive',
      billingPlan: dto.billingPlan || null,
      billingProvider: 'mercadopago',
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
      user.role = dto.role || this.normalizeRole(user.role);
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

  async deleteUser(actor: { id: string; email: string }, id: string) {
    if (actor.id === id) {
      throw new BadRequestException('No puedes eliminar tu propio usuario mientras estÃ¡s autenticado');
    }

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.revokeUserSessions(user.id);
    await this.userRepository.remove(user);
    await this.writeAudit(actor, 'user.delete', 'user', id, {
      email: user.email,
      role: this.normalizeRole(user.role),
    });

    return { ok: true };
  }

  async listLogs(page = 1, pageSize = 10): Promise<PaginatedResult<AdminAuditLog>> {
    const pagination = this.normalizePagination(page, pageSize);
    const [logs, total] = await this.auditLogRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: pagination.skip,
      take: pagination.take,
    });

    return {
      items: logs,
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
    };
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
    const role = this.normalizeRole(user.role);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      companyName: user.companyName,
      role,
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

