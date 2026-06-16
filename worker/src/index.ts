import { Worker, Job, Queue } from 'bullmq';
import * as dotenv from 'dotenv';
import { cleanupPublicScan, processScan } from './processor.js';
import { initializeStorage } from './storage.js';

const PUBLIC_SCAN_TTL_MS = 5 * 60 * 1000;

dotenv.config();

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisUrl = process.env.BULL_REDIS_URL || process.env.REDIS_URL;
const redisPassword = process.env.REDIS_PASSWORD || process.env.REDISPASSWORD;

console.log(`Starting worker. Connecting to Redis at ${redisUrl ? 'REDIS_URL' : `${redisHost}:${redisPort}`}`);

const shouldUseRedisTls = (host: string, protocol?: string) =>
  protocol === 'rediss:' ||
  host.includes('upstash.io') ||
  process.env.REDIS_TLS === 'true' ||
  process.env.BULL_REDIS_TLS === 'true';

const buildRedisConnection = () => {
  if (redisUrl) {
    const parsed = new URL(redisUrl);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
      ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
      ...(shouldUseRedisTls(parsed.hostname, parsed.protocol) ? { tls: {} } : {}),
      maxRetriesPerRequest: null,
    };
  }

  const host = process.env.REDIS_HOST || process.env.REDISHOST || redisHost;
  return {
    host,
    port: parseInt(process.env.REDIS_PORT || process.env.REDISPORT || String(redisPort), 10),
    ...(redisPassword ? { password: redisPassword } : {}),
    ...(shouldUseRedisTls(host) ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
};

async function bootstrap() {
  await initializeStorage();

  // Queue used only to schedule the one-off delayed cleanup of public scans.
  // It does not poll Redis (only issues a command when we add a job), so it has
  // no 24/7 cost — unlike the QueueEvents listener it replaces in the API.
  const scansQueue = new Queue('scans', { connection: buildRedisConnection() });

  const schedulePublicScanCleanup = async (scanId: string) => {
    if (!scanId) return;
    try {
      await scansQueue.add(
        'cleanup-public-scan',
        { scanId },
        {
          delay: PUBLIC_SCAN_TTL_MS,
          jobId: `cleanup-public-scan-${scanId}`,
          removeOnComplete: true,
          removeOnFail: 20,
        },
      );
    } catch (err) {
      console.warn(`Failed to schedule public scan cleanup for ${scanId}:`, err);
    }
  };

  const worker = new Worker(
    'scans',
    async (job: Job) => {
      console.log(`Processing job ${job.id} (${job.name})`);
      try {
        if (job.name === 'cleanup-public-scan') {
          await cleanupPublicScan(String(job.data?.scanId || ''));
          return;
        }
        await processScan(job);
      } catch (err) {
        console.error(`Failed to process job ${job.id}:`, err);
        throw err;
      }
    },
    {
      connection: buildRedisConnection(),
      concurrency: 1,
      stalledInterval: 5 * 60 * 1000,
      lockDuration: 10 * 60 * 1000, // 10 min lock — renewed every 5 min instead of every 15s
      // Idle worker blocks 30s per poll instead of 5s. New jobs still return immediately
      // (blocking pop unblocks on push), so this only cuts wasted Redis commands when idle.
      drainDelay: 30,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} has completed!`);
    if (job.name === 'process-scan' && job.data?.publicScan && job.data?.scanId) {
      void schedulePublicScanCleanup(String(job.data.scanId));
    }
  });

  worker.on('failed', (job, err) => {
    console.log(`Job ${job?.id} has failed with ${err.message}`);
    if (job?.name === 'process-scan' && job.data?.publicScan && job.data?.scanId) {
      void schedulePublicScanCleanup(String(job.data.scanId));
    }
  });
}

bootstrap().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
