import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { pgPool } from './config/db.js';

const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

export async function createAlertHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { user_id, symbol, target_price, condition } = req.body;

    // 1. Fail Fast Input Validation
    if (!user_id || !symbol || !target_price || !condition) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Missing required fields: user_id, symbol, target_price, condition',
      });
    }

    if (!['ABOVE', 'BELOW'].includes(condition.toUpperCase())) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Condition must be either ABOVE or BELOW',
      });
    }

    const normalizedSymbol = symbol.toUpperCase();
    const normalizedCondition = condition.toUpperCase();
    const priceNum = Number(target_price);

    // 2. Persist to PostgreSQL (System of Record)
    const insertQuery = `
      INSERT INTO price_alerts (user_id, symbol, target_price, condition, status)
      VALUES ($1, $2, $3, $4, 'ACTIVE')
      RETURNING id, user_id, symbol, target_price, condition, status, created_at
    `;

    const result = await pgPool.query(insertQuery, [
      user_id,
      normalizedSymbol,
      priceNum,
      normalizedCondition,
    ]);

    const newAlert = result.rows[0];

    // 3. Sync into Redis Sorted Set (Speed Layer)
    // Key format: alerts:ABOVE:BTC-USD or alerts:BELOW:BTC-USD
    const redisKey = `alerts:${normalizedCondition}:${normalizedSymbol}`;
    
    // ZADD key score member
    await redis.zadd(redisKey, priceNum, newAlert.id);

    console.log(`📌 Active Alert Indexed in Redis -> Key: ${redisKey} | Target: ${priceNum} | ID: ${newAlert.id}`);

    // 4. Return Created Response
    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Price alert created and indexed successfully',
      data: newAlert,
    });
  } catch (error) {
    next(error);
  }
}