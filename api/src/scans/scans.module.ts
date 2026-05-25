import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Scan } from './entities/scan.entity';
import { Project } from '../projects/entities/project.entity';
import { ScansService } from './scans.service';
import { ScansController } from './scans.controller';
import { ScansEventsListener } from './scans-events.listener';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Scan, Project]),
    BullModule.registerQueue({
      name: 'scans',
    }),
    EventsModule,
  ],
  providers: [ScansService, ScansEventsListener],
  controllers: [ScansController],
  exports: [ScansService],
})
export class ScansModule {}
