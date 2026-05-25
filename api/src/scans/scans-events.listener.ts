import { QueueEventsListener, QueueEventsHost, OnQueueEvent } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventsGateway } from '../events/events.gateway';

@QueueEventsListener('scans')
export class ScansEventsListener extends QueueEventsHost {
  constructor(
    private readonly eventsGateway: EventsGateway,
    @InjectQueue('scans') private readonly scansQueue: Queue
  ) {
    super();
  }

  @OnQueueEvent('progress')
  async onProgress({ jobId, data }: { jobId: string; data: number | string }) {
    const progress = typeof data === 'string' ? parseInt(data, 10) : data;
    const job = await this.scansQueue.getJob(jobId);
    if (job) {
      const scanId = job.data.scanId;
      this.eventsGateway.emitProgress(scanId, progress);
    }
  }

  @OnQueueEvent('completed')
  async onCompleted({ jobId }: { jobId: string }) {
    const job = await this.scansQueue.getJob(jobId);
    if (job) {
      const scanId = job.data.scanId;
      this.eventsGateway.emitScanCompleted(jobId, scanId);
    }
  }
}
