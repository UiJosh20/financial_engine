import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { pgPool } from './config/db.js';
import { subscribeToSymbol, normalizeSymbol } from './services/coinbase.js';

const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

export async function createAlertHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { user_id, symbol, target_price, condition } = req.body;

    // 1. Fail Fast Input Validation
    if (!user_id || !symbol || target_price === undefined || !condition) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Missing required fields: user_id, symbol, target_price, condition',
      });
    }

    const normalizedCondition = condition.toUpperCase();
    if (!['ABOVE', 'BELOW'].includes(normalizedCondition)) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Condition must be either ABOVE or BELOW',
      });
    }

    const priceNum = Number(target_price);
    if (isNaN(priceNum) || priceNum <= 0) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'target_price must be a positive number',
      });
    }

    // 2. Normalize Symbol Formats
    // krakenSymbol -> "BTC/USD" (For Kraken WS API subscription)
    // redisSymbol  -> "BTC-USD" (For Redis key formatting consistency)
    const krakenSymbol = normalizeSymbol(symbol); 
    const redisSymbol = krakenSymbol.replace('/', '-');

    // 3. Persist to PostgreSQL (System of Record)
    const insertQuery = `
      INSERT INTO price_alerts (user_id, symbol, target_price, condition, status)
      VALUES ($1, $2, $3, $4, 'ACTIVE')
      RETURNING id, user_id, symbol, target_price, condition, status, created_at
    `;

    const result = await pgPool.query(insertQuery, [
      user_id,
      krakenSymbol,
      priceNum,
      normalizedCondition,
    ]);

    const newAlert = result.rows[0];

    // 4. Sync into Redis Sorted Set (Speed Layer)
    // Key format: alerts:ABOVE:BTC-USD
    const redisKey = `alerts:${normalizedCondition}:${redisSymbol}`;
    
    // ZADD key score member
    await redis.zadd(redisKey, priceNum, newAlert.id);

    console.log(`📌 Active Alert Indexed in Redis -> Key: ${redisKey} | Target: ${priceNum} | ID: ${newAlert.id}`);

    // 5. Dynamically Subscribe Kraken Stream to New Pair
    subscribeToSymbol(symbol);

    // 6. Return Response
    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Price alert created and indexed successfully',
      data: newAlert,
    });
  } catch (error) {
    next(error);
  }
}