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

  // Cola dedicada al cleanup de scans públicos, separada de la cola principal.
  // Esto evita que un job de limpieza compita en prioridad con scans de usuario
  // y permite tener políticas de retención distintas por tipo de job.
  const cleanupQueue = new Queue('scans-cleanup', { connection: buildRedisConnection() });

  const schedulePublicScanCleanup = async (scanId: string) => {
    if (!scanId) return;
    try {
      await cleanupQueue.add(
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
        await processScan(job);
      } catch (err) {
        console.error(`Failed to process job ${job.id}:`, err);
        throw err;
      }
    },
    {
      connection: buildRedisConnection(),
      concurrency: 1,
      // 60s: detecta un worker caído 5× más rápido que el default de 5 min,
      // sin añadir carga perceptible a Redis (un comando LMOVE por minuto en idle).
      stalledInterval: 60 * 1000,
      lockDuration: 10 * 60 * 1000,
      drainDelay: 30,
    }
  );

  // Worker dedicado a la cola de cleanup, con concurrencia independiente.
  // Al estar separado, un backlog de limpiezas no retrasa scans de usuarios.
  const cleanupWorker = new Worker(
    'scans-cleanup',
    async (job: Job) => {
      console.log(`Processing cleanup job ${job.id}`);
      try {
        await cleanupPublicScan(String(job.data?.scanId || ''));
      } catch (err) {
        console.error(`Failed to process cleanup job ${job.id}:`, err);
        throw err;
      }
    },
    {
      connection: buildRedisConnection(),
      concurrency: 2,
      stalledInterval: 60 * 1000,
      drainDelay: 30,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} has completed!`);
    if (job.data?.publicScan && job.data?.scanId) {
      void schedulePublicScanCleanup(String(job.data.scanId));
    }
  });

  worker.on('failed', (job, err) => {
    console.log(`Job ${job?.id} has failed with ${err.message}`);
    if (job?.data?.publicScan && job.data?.scanId) {
      void schedulePublicScanCleanup(String(job.data.scanId));
    }
  });

  cleanupWorker.on('failed', (job, err) => {
    console.warn(`Cleanup job ${job?.id} failed: ${err.message}`);
  });
}

bootstrap().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
