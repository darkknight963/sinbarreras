import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { QueueEvents } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class ScanEventsListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScanEventsListener.name);
  private queueEvents: QueueEvents | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL') || this.configService.get<string>('UPSTASH_REDIS_REST_URL');
    if (!redisUrl) {
      this.logger.warn('No REDIS_URL configured — scan WebSocket push notifications disabled');
      return;
    }

    const connection = redisUrl.startsWith('rediss://') || redisUrl.startsWith('redis://')
      ? { url: redisUrl }
      : undefined;

    try {
      this.queueEvents = new QueueEvents('scans', {
        connection: connection ?? {
          host: this.configService.get<string>('REDIS_HOST', 'localhost'),
          port: this.configService.get<number>('REDIS_PORT', 6379),
        },
      });

      this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
        try {
          const data = typeof returnvalue === 'string' ? JSON.parse(returnvalue) : returnvalue;
          const scanId: string | undefined = data?.scanId;
          if (scanId) {
            this.eventsGateway.emitScanCompleted(jobId, scanId);
            this.logger.debug(`Emitted scan-completed for scanId=${scanId}`);
          }
        } catch {
          // returnvalue parse failure — non-fatal, frontend falls back to polling
        }
      });

      this.queueEvents.on('failed', ({ jobId, failedReason }) => {
        this.logger.warn(`Scan job ${jobId} failed: ${failedReason}`);
        // No scanId available on failure without fetching the job — frontend polls fallback
      });

      this.logger.log('ScanEventsListener connected to BullMQ queue');
    } catch (err) {
      this.logger.error('ScanEventsListener failed to connect — push notifications disabled', err);
    }
  }

  async onModuleDestroy() {
    await this.queueEvents?.close().catch(() => {});
  }
}
