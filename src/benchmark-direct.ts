import { pgPool } from "./config/db.js";

async function runBenchmark() {
const TOTAL_REQUEST = 1000
console.log(`Firing ${TOTAL_REQUEST} concurrent requests directly into db...`);  
const startTime = Date.now();
let successCount = 0
let failureCount = 0

const requests = Array.from({length: TOTAL_REQUEST}).map(async(_,index)=>{
   try{
    await pgPool.query(`INSERT INTO market_events(event_type, symbol, price, payload) VALUES($1, $2, $3, $4)`, ['TRADE_EXECUTION', 'BTC-USD', (65000 + Math.random() * 500).toFixed(2), JSON.stringify({request_id: `order_${index}`, priority:"HIGH"})])
    successCount++
   }catch(error:any){
    failureCount++
    if(failureCount <= 3){
      console.error(`Request ${index} failed: ${error.message}`)
    }
    
   }
});

await Promise.allSettled(requests)
const duration = (Date.now()-startTime) / 1000;
console.log(`\n📊 Benchmark Results (Direct Postgres Write):`);
  console.log(`-------------------------------------------`);
  console.log(`⏱️ Total Time: ${duration.toFixed(2)} seconds`);
  console.log(`✅ Successful Inserts: ${successCount}`);
  console.log(`❌ Failed Inserts: ${failureCount}`);
  console.log(`⚡ Throughput: ${(successCount / duration).toFixed(0)} req/sec`);

  await pgPool.end()
}

runBenchmark()
