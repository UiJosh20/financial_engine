import autocannon from 'autocannon';

const TEST_USER_ID = '89ae8025-b96b-4e15-b931-ddcabc6b0804'; // 👈 Replace with your actual User UUID

async function runLoadTest() {
  console.log('🔥 Starting API Load Test with Autocannon...');
  console.log('🎯 Target: POST http://localhost:3000/api/v1/alerts');

  const result = await autocannon({
    url: 'http://localhost:3000/api/v1/alerts',
    connections: 20,       // 20 concurrent TCP connections
    duration: 10,          // Run test for 10 seconds
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    // Generate a fresh payload for every request to simulate live users
    setupClient: (client:any) => {
      client.setBody(
        JSON.stringify({
          user_id: TEST_USER_ID,
          symbol: 'BTC-USD',
          target_price: Math.floor(Math.random() * (70000 - 60000 + 1)) + 60000,
          condition: Math.random() > 0.5 ? 'ABOVE' : 'BELOW',
        })
      );
    },
  });

  console.log('\n📊 --- LOAD TEST RESULTS --- 📊');
  console.log(`🚀 Requests/sec (Req/Sec): ${result.requests.average}`);
  console.log(`⚡ Throughput (Bytes/sec): ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/s`);
  console.log(`⏱️ Average Latency:       ${result.latency.average} ms`);
  console.log(`⏱️ 99th Percentile Latency: ${result.latency.p99} ms`);
  console.log(`❌ Total 4xx/5xx Errors:   ${result.errors + result.non2xx}`);
  console.log(`✅ Total 2xx Successful:   ${result['2xx']}`);
}

runLoadTest();