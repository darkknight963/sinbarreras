import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Scan } from './entities/scan.entity';
import { Project } from '../projects/entities/project.entity';
import { UrlResult } from '../url-results/entities/url-result.entity';
import { ScansService } from './scans.service';
import { ScansController } from './scans.controller';
import { RequestRateLimitService } from '../security/request-rate-limit.service';
import { ScanEventsListener } from './scan-events.listener';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Scan, Project, UrlResult]),
    BullModule.registerQueue({ name: 'scans' }),
    EventsModule,
  ],
  providers: [ScansService, RequestRateLimitService, ScanEventsListener],
  controllers: [ScansController],
  exports: [ScansService],
})
export class ScansModule {}
