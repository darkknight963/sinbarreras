import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Scan } from './entities/scan.entity';
import { Project } from '../projects/entities/project.entity';
import { UrlResult } from '../url-results/entities/url-result.entity';
import { ScansService } from './scans.service';
import { ScansController } from './scans.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Scan, Project, UrlResult]),
    BullModule.registerQueue({
      name: 'scans',
    }),
  ],
  providers: [ScansService],
  controllers: [ScansController],
  exports: [ScansService],
})
export class ScansModule {}
