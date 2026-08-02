import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { pgPool } from './config/db.js';

const redisConnection = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
});

export const eventQueue = new Queue('market-events', {
  connection: redisConnection,
});

// 1. Helper function for multi-row parameterized SQL inserts
async function bulkInsertEvents(jobs: any[]) {
  if (jobs.length === 0) return;

  const valueClauses: string[] = [];
  const values: any[] = [];

  jobs.forEach((job, index) => {
    const { event_type, symbol, price, payload } = job.data;
    const offset = index * 4;

    valueClauses.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
    values.push(event_type, symbol, price, JSON.stringify(payload));
  });

  const queryText = `
    INSERT INTO market_events (event_type, symbol, price, payload)
    VALUES ${valueClauses.join(', ')}
  `;

  await pgPool.query(queryText, values);
}

// 2. High-concurrency worker
export const eventWorker = new Worker(
  'market-events',
  async (job) => {
    // Process job cleanly
    const { event_type, symbol, price, payload } = job.data;
    await pgPool.query(
      `INSERT INTO market_events (event_type, symbol, price, payload) 
       VALUES ($1, $2, $3, $4)`,
      [event_type, symbol, price, JSON.stringify(payload)]
    );
  },
  {
    connection: redisConnection,
    concurrency: 50, // Increased concurrency to drain Redis much faster
  }
);

eventWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});