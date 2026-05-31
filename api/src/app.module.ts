import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Project } from './projects/entities/project.entity';
import { Scan } from './scans/entities/scan.entity';
import { UrlResult } from './url-results/entities/url-result.entity';
import { ProjectsModule } from './projects/projects.module';
import { ScansModule } from './scans/scans.module';
import { UrlResultsModule } from './url-results/url-results.module';
import { EventsModule } from './events/events.module';
import { ComplianceModule } from './compliance/compliance.module';
import { ReportsModule } from './reports/reports.module';
import { EvidenceModule } from './evidence/evidence.module';
import { ApiTokenGuard } from './auth/api-token.guard';
import { RequestRateLimitGuard } from './security/request-rate-limit.guard';
import { RequestRateLimitService } from './security/request-rate-limit.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_NAME', 'accessibility_db'),
        entities: [Project, Scan, UrlResult],
        synchronize: config.get<string>('DB_SYNCHRONIZE') === 'true',
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'scans',
    }),
    ProjectsModule,
    ScansModule,
    UrlResultsModule,
    EventsModule,
    ComplianceModule,
    ReportsModule,
    EvidenceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    RequestRateLimitService,
    {
      provide: APP_GUARD,
      useClass: ApiTokenGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RequestRateLimitGuard,
    },
  ],
})
export class AppModule {}
