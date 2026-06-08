import { Worker, Job } from 'bullmq';
import * as dotenv from 'dotenv';
import { cleanupPublicScan, processScan } from './processor.js';
import { initializeStorage } from './storage.js';

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
      concurrency: 2,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} has completed!`);
  });

  worker.on('failed', (job, err) => {
    console.log(`Job ${job?.id} has failed with ${err.message}`);
  });
}

bootstrap().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
