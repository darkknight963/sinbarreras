import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Session } from '../auth/entities/session.entity';
import { User } from '../auth/entities/user.entity';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Session, AdminAuditLog]), AuthModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
