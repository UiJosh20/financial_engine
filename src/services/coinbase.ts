import WebSocket from 'ws';
import { Redis } from 'ioredis';
import { eventQueue } from '../queue.js';
import { broadcastToClients } from '../ws.js';

const redis = new Redis({ host: 'localhost', port: 6379 });
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws';

let ws: WebSocket | null = null;
const activeSymbols = new Set<string>(['btcusdt', 'ethusdt', 'solusdt', 'ltcusdt']);

/**
 * Normalizes input like "BTC-USD", "btc/usd", or "solusdt" to lowercase Binance format "btcusdt"
 */
export function normalizeSymbol(rawSymbol:any) {
  if (!rawSymbol) return "";
  let cleaned = rawSymbol.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (cleaned.endsWith("USDT")) {
    return cleaned;
  }
  if (cleaned.endsWith("USD")) {
    return cleaned.slice(0, -3) + "USDT";
  }
  return `${cleaned}USDT`;
}

export function subscribeToSymbol(rawSymbol: string) {
  const streamSymbol = normalizeSymbol(rawSymbol);

  if (activeSymbols.has(streamSymbol)) return;
  activeSymbols.add(streamSymbol);

  if (ws && ws.readyState === WebSocket.OPEN) {
    const payload = {
      method: 'SUBSCRIBE',
      params: [`${streamSymbol}@ticker`],
      id: Date.now(),
    };
    ws.send(JSON.stringify(payload));
  }
}

export function startMarketStream() {
  console.log('🔄 Connecting to Binance Live WebSocket Feed...');
  ws = new WebSocket(BINANCE_WS_URL);

  ws.on('open', () => {
    console.log('📡 Connected to Binance Public Stream!');

    const streams = Array.from(activeSymbols).map((s) => `${s}@ticker`);
    const payload = {
      method: 'SUBSCRIBE',
      params: streams,
      id: 1,
    };
    ws?.send(JSON.stringify(payload));
  });

  ws.on('message', async (rawData: WebSocket.RawData) => {
    try {
      const data = JSON.parse(rawData.toString());

      // Binance Ticker event "24hrTicker"
      if (data.e === '24hrTicker' && data.c) {
        const rawSymbol = data.s; // e.g. "BTCUSDT"
        const currentPrice = parseFloat(data.c); // Last price
        
        // Convert to UI display format e.g. "BTC/USDT"
        const formattedSymbol = `${rawSymbol.replace('USDT', '')}/USDT`;

        await evaluateAlerts(formattedSymbol, rawSymbol, currentPrice);
      }
    } catch (err) {
      console.error('❌ Binance WS Parse Error:', err);
    }
  });

  ws.on('error', (err) => {
    console.error('🚨 Binance WS Error:', err.message);
  });

  ws.on('close', () => {
    console.warn('⚠️ Binance WS Closed. Reconnecting in 3s...');
    setTimeout(() => startMarketStream(), 3000);
  });
}

async function evaluateAlerts(displaySymbol: string, rawSymbol: string, price: number) {
  // Key format for Redis: "alerts:ABOVE:BTCUSDT"
  const redisSymbol = rawSymbol.toUpperCase();

  // Broadcast to Web Dashboard
  broadcastToClients({
    type: 'TICKER',
    symbol: displaySymbol,
    price,
    timestamp: new Date().toISOString(),
  });

  // 1. Check ABOVE alerts
  const aboveKey = `alerts:ABOVE:${redisSymbol}`;
  const triggeredAbove = await redis.zrangebyscore(aboveKey, 0, price);

  if (triggeredAbove.length > 0) {
    await redis.zrem(aboveKey, ...triggeredAbove);
    for (const alertId of triggeredAbove) {
      await eventQueue.add('PROCESS_TRIGGER', { alertId, symbol: displaySymbol, triggeredPrice: price, condition: 'ABOVE' });
    }
    broadcastToClients({ type: 'ALERT_TRIGGERED', condition: 'ABOVE', symbol: displaySymbol, price, alertIds: triggeredAbove });
  }

  // 2. Check BELOW alerts
  const belowKey = `alerts:BELOW:${redisSymbol}`;
  const triggeredBelow = await redis.zrangebyscore(belowKey, price, '+inf');

  if (triggeredBelow.length > 0) {
    await redis.zrem(belowKey, ...triggeredBelow);
    for (const alertId of triggeredBelow) {
      await eventQueue.add('PROCESS_TRIGGER', { alertId, symbol: displaySymbol, triggeredPrice: price, condition: 'BELOW' });
    }
    broadcastToClients({ type: 'ALERT_TRIGGERED', condition: 'BELOW', symbol: displaySymbol, price, alertIds: triggeredBelow });
  }
}