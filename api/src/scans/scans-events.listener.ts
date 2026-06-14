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
  onProgress({ data }: { jobId: string; data: { scanId: string; value: number } | number | string }) {
    // Worker sends { scanId, value } — no extra Redis getJob() needed
    if (typeof data === 'object' && data !== null && 'scanId' in data) {
      this.eventsGateway.emitProgress(data.scanId, data.value);
    }
  }

  @OnQueueEvent('completed')
  async onCompleted({ jobId, returnvalue }: { jobId: string; returnvalue: string }) {
    // Worker returns { scanId, publicScan } — parse without extra getJob()
    try {
      const result = returnvalue ? (JSON.parse(returnvalue) as { scanId?: string; publicScan?: boolean }) : null;
      if (result?.scanId) {
        this.eventsGateway.emitScanCompleted(jobId, result.scanId);
        if (result.publicScan) {
          await this.schedulePublicScanCleanup(result.scanId);
        }
        return;
      }
    } catch {
      // fallback to getJob if returnvalue is missing/malformed
    }
    const job = await this.scansQueue.getJob(jobId);
    if (job) {
      this.eventsGateway.emitScanCompleted(jobId, job.data.scanId);
      await this.schedulePublicScanCleanup(job.data.scanId, job.data.publicScan);
    }
  }

  @OnQueueEvent('failed')
  async onFailed({ jobId }: { jobId: string }) {
    const job = await this.scansQueue.getJob(jobId);
    if (job?.data?.publicScan && job.data.scanId) {
      await this.schedulePublicScanCleanup(job.data.scanId, true);
    }
  }

  private async schedulePublicScanCleanup(scanId: string, isPublic = true) {
    if (!isPublic || !scanId) return;

    await this.scansQueue.add(
      'cleanup-public-scan',
      { scanId },
      {
        delay: PUBLIC_SCAN_TTL_MS,
        jobId: `cleanup-public-scan-${scanId}`,
        removeOnComplete: true,
        removeOnFail: 20,
      },
    );
  }
}
