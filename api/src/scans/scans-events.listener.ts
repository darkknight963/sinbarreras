import { QueueEventsListener, QueueEventsHost, OnQueueEvent } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventsGateway } from '../events/events.gateway';

const PUBLIC_SCAN_TTL_MS = 5 * 60 * 1000;

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
      await this.schedulePublicScanCleanup(job);
    }
  }

  @OnQueueEvent('failed')
  async onFailed({ jobId }: { jobId: string }) {
    const job = await this.scansQueue.getJob(jobId);
    if (job) {
      await this.schedulePublicScanCleanup(job);
    }
  }

  private async schedulePublicScanCleanup(job: Awaited<ReturnType<Queue['getJob']>>) {
    if (!job?.data?.publicScan || !job.data.scanId) return;

    await this.scansQueue.add(
      'cleanup-public-scan',
      { scanId: job.data.scanId },
      {
        delay: PUBLIC_SCAN_TTL_MS,
        jobId: `cleanup-public-scan-${job.data.scanId}`,
        removeOnComplete: true,
        removeOnFail: 20,
      },
    );
  }
}
