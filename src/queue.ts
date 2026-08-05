import { Queue, Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { pgPool, redisPool } from "./config/db.js";

const connection = redisPool;

// 1. Initialize BullMQ Queue
export const eventQueue = new Queue("financial-events", { connection });

// 2. Define the Job Payload Structure
export interface TriggeredAlertPayload {
  alertId: string;
  symbol: string;
  triggeredPrice: number;
  condition: string;
}

// 3. Initialize BullMQ Worker to Process Jobs Asynchronously
export const alertWorker = new Worker(
  "financial-events",
  async (job: Job<TriggeredAlertPayload>) => {
    const { alertId, symbol, triggeredPrice, condition } = job.data;
    console.log(
      `⚙️ [Worker] Processing triggered alert job #${job.id} for alert ${alertId}...`,
    );

    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");

      // Update alert status in PostgreSQL
      await client.query(
        `UPDATE price_alerts SET status = 'TRIGGERED' WHERE id = $1`,
        [alertId],
      );

      // Insert immutable audit record into alert_logs
      await client.query(
        `INSERT INTO alert_logs (alert_id, triggered_price) VALUES ($1, $2)`,
        [alertId, triggeredPrice],
      );

      await client.query("COMMIT");
      console.log(
        `✅ [Worker] Successfully persisted trigger log to PostgreSQL for alert: ${alertId}`,
      );
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`❌ [Worker] Failed to process job #${job.id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  },
  { connection },
);
