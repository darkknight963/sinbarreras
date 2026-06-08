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
import { User } from './auth/entities/user.entity';
import { Session } from './auth/entities/session.entity';
import { BillingSubscription } from './billing/entities/billing-subscription.entity';
import { ProjectsModule } from './projects/projects.module';
import { ScansModule } from './scans/scans.module';
import { UrlResultsModule } from './url-results/url-results.module';
import { EventsModule } from './events/events.module';
import { ComplianceModule } from './compliance/compliance.module';
import { ReportsModule } from './reports/reports.module';
import { EvidenceModule } from './evidence/evidence.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { ApiTokenGuard } from './auth/api-token.guard';
import { RequestRateLimitGuard } from './security/request-rate-limit.guard';
import { RequestRateLimitService } from './security/request-rate-limit.service';

const buildRedisConnection = (redisUrl: string | undefined, fallback: { host: string; port: number; password?: string }) => {
  if (!redisUrl) return fallback;

  const parsed = new URL(redisUrl);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
  };
};

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
        ...(config.get<string>('DATABASE_URL')
          ? { url: config.get<string>('DATABASE_URL') }
          : {
              host: config.get<string>('DB_HOST', 'localhost'),
              port: config.get<number>('DB_PORT', 5432),
              username: config.get<string>('DB_USER', 'postgres'),
              password: config.get<string>('DB_PASSWORD', 'postgres'),
              database: config.get<string>('DB_NAME', 'accessibility_db'),
            }),
        entities: [Project, Scan, UrlResult, User, Session, BillingSubscription],
        synchronize: config.get<string>('DB_SYNCHRONIZE') === 'true',
      }),
    }),
    TypeOrmModule.forFeature([User, Session, BillingSubscription]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('BULL_REDIS_URL') || config.get<string>('REDIS_URL');
        const redisPassword = config.get<string>('REDIS_PASSWORD') || config.get<string>('REDISPASSWORD');

        return {
          connection: buildRedisConnection(redisUrl, {
                host: config.get<string>('REDIS_HOST') || config.get<string>('REDISHOST') || 'localhost',
                port: Number(config.get<string>('REDIS_PORT') || config.get<string>('REDISPORT') || 6379),
                ...(redisPassword ? { password: redisPassword } : {}),
              }),
        };
      },
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
    AuthModule,
    BillingModule,
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
