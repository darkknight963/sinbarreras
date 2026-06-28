import { Worker, Job, Queue } from 'bullmq';
import * as dotenv from 'dotenv';
import { cleanupPublicScan, processScan } from './processor.js';
import { initializeStorage, cleanupExpiredEvidence } from './storage.js';
import { createLogger } from './logger.js';
import { browserPool } from './browser-pool.js';

const log = createLogger('worker');

const PUBLIC_SCAN_TTL_MS = 5 * 60 * 1000;

dotenv.config();

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisUrl = process.env.BULL_REDIS_URL || process.env.REDIS_URL;
const redisPassword = process.env.REDIS_PASSWORD || process.env.REDISPASSWORD;

log.info('Worker iniciando', { redis: redisUrl ? 'REDIS_URL' : `${redisHost}:${redisPort}` });

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

  // Cola dedicada al cleanup de scans públicos y evidencias expiradas, separada de la
  // cola principal para que los jobs de limpieza no compitan con scans de usuario.
  const cleanupQueue = new Queue('scans-cleanup', { connection: buildRedisConnection() });

  // Programa un job de cleanup de evidencias en R2 cada 24 horas.
  // Se hace aquí (BullMQ) en vez de en initializeStorage para evitar bloquear el
  // arranque del worker y para poder distribuir el trabajo si hay varios workers.
  const EVIDENCE_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
  await cleanupQueue.add(
    'cleanup-expired-evidence',
    {},
    {
      jobId: 'cleanup-expired-evidence-recurring',
      repeat: { every: EVIDENCE_CLEANUP_INTERVAL_MS },
      removeOnComplete: true,
      removeOnFail: 5,
    },
  ).catch((err) => log.warn('No se pudo programar cleanup de evidencias', { error: (err as Error)?.message }));

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
      log.warn('No se pudo programar el cleanup del scan público', { scanId, error: (err as Error)?.message });
    }
  };

  // WORKER_CONCURRENCY controla cuántos scans (jobs) corren en paralelo.
  // Los viewports (desktop→tablet→móvil) corren secuencialmente dentro de cada job:
  // paralelo fue revertido para evitar falsos negativos bajo presión de memoria.
  // Con concurrencia 1: ~250-350MB por job — seguro en Railway con 512MB-1GB.
  // Con concurrencia 2: ~500-700MB — requiere plan Railway con 2GB+.
  // Default conservador: 1. Aumentar via WORKER_CONCURRENCY solo con RAM confirmada.
  const workerConcurrency = Number(process.env.WORKER_CONCURRENCY || 1);

  // lockDuration: tiempo máximo que un job puede tener el lock antes de ser
  // marcado como stalled. Un scan "profundo" de 50 URLs puede tardar 30+ minutos.
  const lockDurationMs = Number(process.env.WORKER_LOCK_DURATION_MS || 45 * 60 * 1000);

  // drainDelay: tiempo de espera entre polls cuando la cola está vacía.
  // Upstash free tier: 500k requests/mes. Con drainDelay=5000 y 2 workers
  // el polling idle consume ~1M requests/mes — dentro del límite.
  // Con drainDelay=30 (default) consumía ~500k requests/día, agotando el plan.
  const drainDelayMs = Number(process.env.WORKER_DRAIN_DELAY_MS || 5000);

  const worker = new Worker(
    'scans',
    async (job: Job) => {
      log.info('Procesando job', { jobId: job.id, jobName: job.name });
      try {
        await processScan(job);
      } catch (err) {
        log.error('Job falló', { jobId: job.id, error: (err as Error)?.message });
        throw err;
      }
    },
    {
      connection: buildRedisConnection(),
      concurrency: workerConcurrency,
      stalledInterval: 60 * 1000,
      lockDuration: lockDurationMs,
      drainDelay: drainDelayMs,
    }
  );
  log.info('Worker iniciado', { concurrency: workerConcurrency, lockDurationMs, drainDelayMs });

  const cleanupWorker = new Worker(
    'scans-cleanup',
    async (job: Job) => {
      log.info('Procesando cleanup job', { jobId: job.id, jobName: job.name });
      try {
        if (job.name === 'cleanup-expired-evidence') {
          await cleanupExpiredEvidence();
        } else {
          await cleanupPublicScan(String(job.data?.scanId || ''));
        }
      } catch (err) {
        log.error('Cleanup job falló', { jobId: job.id, error: (err as Error)?.message });
        throw err;
      }
    },
    {
      connection: buildRedisConnection(),
      concurrency: 2,
      stalledInterval: 60 * 1000,
      drainDelay: drainDelayMs,
    }
  );

  worker.on('completed', (job) => {
    log.info('Job completado', { jobId: job.id });
    if (job.data?.publicScan && job.data?.scanId) {
      void schedulePublicScanCleanup(String(job.data.scanId));
    }
  });

  worker.on('failed', (job, err) => {
    log.error('Job fallido', { jobId: job?.id, error: err.message });
    if (job?.data?.publicScan && job.data?.scanId) {
      void schedulePublicScanCleanup(String(job.data.scanId));
    }
  });

  cleanupWorker.on('failed', (job, err) => {
    log.warn('Cleanup job fallido', { jobId: job?.id, error: err.message });
  });

  // Cierre limpio del browser pool cuando Railway detiene el contenedor (SIGTERM/SIGINT)
  const shutdown = async (signal: string) => {
    log.info(`${signal} recibido — cerrando browser pool y workers`);
    await Promise.allSettled([worker.close(), cleanupWorker.close(), browserPool.shutdown()]);
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  log.error('Worker falló al iniciar', { error: (err as Error)?.message });
  process.exit(1);
});
