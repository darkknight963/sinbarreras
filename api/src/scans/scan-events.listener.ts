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
    // QueueEvents deshabilitado: hace polling agresivo a Redis (XREAD en loop)
    // generando millones de comandos. El frontend usa animacion local para el
    // progreso del escaneo, no necesita push en tiempo real.
    this.logger.log('ScanEventsListener deshabilitado — frontend usa progreso local');
  }

  async onModuleDestroy() {
    await this.queueEvents?.close().catch(() => {});
  }
}
