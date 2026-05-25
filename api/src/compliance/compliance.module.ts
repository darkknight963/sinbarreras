import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../projects/entities/project.entity';
import { Scan } from '../scans/entities/scan.entity';
import { ComplianceController } from './compliance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Scan])],
  controllers: [ComplianceController],
})
export class ComplianceModule {}
