import { pgPool } from "./config/db.js";
import { eventQueue, eventWorker } from "./queue.js";

async function runBenchmark() {
  const TOTAL_REQUEST = 1000;
  console.log(`Firing ${TOTAL_REQUEST} concurrent requests into queue...`);
  const startTime = Date.now();
  let successCount = 0;
  let failureCount = 0;

  const queueJobs = Array.from({ length: TOTAL_REQUEST }).map(
    async (_, index) => {
      await eventQueue.add("INGEST_EVENT", {
        event_type: "TRADE_EXECUTION",
        symbol: "BTC-USD",
        price: (65000 + Math.random() * 500).toFixed(2),
        payload: JSON.stringify({
          request_id: `order_${index}`,
          priority: "HIGH",
        }),
      });
    },
  );

  await Promise.all(queueJobs);
  const enqueueTime = (Date.now() - startTime) / 1000;

  console.log(`📊 Ingestion Phase (App -> Redis RAM):`);
  console.log(`-------------------------------------------`);
  console.log(`⏱️ Ingestion Time: ${enqueueTime.toFixed(3)} seconds`);
  console.log(`⚡ Ingestion Throughput: ${(TOTAL_REQUEST / enqueueTime).toFixed(0)} req/sec`);
  console.log(`\n⏳ Background worker is now saving jobs into PostgreSQL...`);

  // Step 2: Listen for when the queue finishes saving everything to Postgres
  eventWorker.on('drained', async () => {
    const totalTime = (Date.now() - startTime) / 1000;
    console.log(`\n✅ All ${TOTAL_REQUEST} jobs successfully saved to PostgreSQL!`);
    console.log(`⏱️ Total Execution Time: ${totalTime.toFixed(2)} seconds`);

    // Clean up connections so the script exits cleanly
    await eventWorker.close();
    await eventQueue.close();
    await pgPool.end();
    process.exit(0);
  });
}

runBenchmark()
