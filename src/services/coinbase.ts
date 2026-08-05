import WebSocket from 'ws';
import { eventQueue } from '../queue.js';
import { broadcastToClients } from '../ws.js';
import { pgPool, redisPool } from '../config/db.js';

const redis = redisPool;
// const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws';
const BINANCE_WS_URL = 'wss://stream.binance.us:9443/ws';

let ws: WebSocket | null = null;
const activeSymbols = new Set<string>(['btcusdt', 'ethusdt', 'solusdt', 'ltcusdt']);

export function normalizeSymbol(rawSymbol: any): string {
  if (!rawSymbol) return "";
  let cleaned = rawSymbol.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (cleaned.endsWith("USDT")) {
    return `${cleaned.slice(0, -4)}/USDT`;
  }
  if (cleaned.endsWith("USD")) {
    return `${cleaned.slice(0, -3)}/USDT`;
  }
  return `${cleaned}/USDT`;
}

export function subscribeToSymbol(rawSymbol: string) {
  const formatted = normalizeSymbol(rawSymbol);
  const streamSymbol = formatted.replace('/', '').toLowerCase();

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
      if (data.e === '24hrTicker' && data.c) {
        const rawSymbol = data.s; // e.g. "BTCUSDT"
        const currentPrice = parseFloat(data.c);
        const displaySymbol = `${rawSymbol.replace('USDT', '')}/USDT`;

        await evaluateAlertsWithRearm(displaySymbol, rawSymbol, currentPrice);
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

async function evaluateAlertsWithRearm(displaySymbol: string, redisSymbol: string, price: number) {
  broadcastToClients({
    type: 'TICKER',
    symbol: displaySymbol,
    price,
    timestamp: new Date().toISOString(),
  });

  const aboveKey = `alerts:ABOVE:${redisSymbol}`;
  const belowKey = `alerts:BELOW:${redisSymbol}`;

  // 1. Evaluate ABOVE alerts & Re-arm logic
  const candidateAboves = await redis.zrange(aboveKey, '0', '-1', 'WITHSCORES');
  for (let i = 0; i < candidateAboves.length; i += 2) {
    const alertId = candidateAboves[i];
    const targetPrice = parseFloat(candidateAboves[i + 1]);
    const dbRes = await pgPool.query('SELECT is_triggered, user_id FROM price_alerts WHERE id = $1', [alertId]);
    if (dbRes.rows.length === 0) continue;
    const { is_triggered, user_id } = dbRes.rows[0];

    if (price >= targetPrice && !is_triggered) {
      await pgPool.query('UPDATE price_alerts SET is_triggered = true, status = $1 WHERE id = $2', ['TRIGGERED', alertId]);
      await eventQueue.add('PROCESS_TRIGGER', { alertId, symbol: displaySymbol, triggeredPrice: price, condition: 'ABOVE' });
      broadcastToClients({ type: 'ALERT_TRIGGERED', user_id, condition: 'ABOVE', symbol: displaySymbol, price, alertId });
    } else if (price < targetPrice && is_triggered) {
      // Re-arm when price drops back down below target
      await pgPool.query('UPDATE price_alerts SET is_triggered = false, status = $1 WHERE id = $2', ['ACTIVE', alertId]);
    }
  }

  // 2. Evaluate BELOW alerts & Re-arm logic
  const candidateBelows = await redis.zrange(belowKey, '0', '-1', 'WITHSCORES');
  for (let i = 0; i < candidateBelows.length; i += 2) {
    const alertId = candidateBelows[i];
    const targetPrice = parseFloat(candidateBelows[i + 1]);
    const dbRes = await pgPool.query('SELECT is_triggered, user_id FROM price_alerts WHERE id = $1', [alertId]);
    if (dbRes.rows.length === 0) continue;
    const { is_triggered, user_id } = dbRes.rows[0];

    if (price <= targetPrice && !is_triggered) {
      await pgPool.query('UPDATE price_alerts SET is_triggered = true, status = $1 WHERE id = $2', ['TRIGGERED', alertId]);
      await eventQueue.add('PROCESS_TRIGGER', { alertId, symbol: displaySymbol, triggeredPrice: price, condition: 'BELOW' });
      broadcastToClients({ type: 'ALERT_TRIGGERED', user_id, condition: 'BELOW', symbol: displaySymbol, price, alertId });
    } else if (price > targetPrice && is_triggered) {
      // Re-arm when price rises back up above target
      await pgPool.query('UPDATE price_alerts SET is_triggered = false, status = $1 WHERE id = $2', ['ACTIVE', alertId]);
    }
  }
}