import { Worker, Job } from 'bullmq';
import * as dotenv from 'dotenv';
import { processScan } from './processor.js';
import { initializeStorage } from './storage.js';

dotenv.config();

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

console.log(`Starting worker. Connecting to Redis at ${redisHost}:${redisPort}`);

async function bootstrap() {
  await initializeStorage();

  const worker = new Worker(
    'scans',
    async (job: Job) => {
      console.log(`Processing job ${job.id} for project scan`);
      try {
        await processScan(job);
      } catch (err) {
        console.error(`Failed to process job ${job.id}:`, err);
        throw err;
      }
    },
    {
      connection: {
        host: redisHost,
        port: redisPort,
      },
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
