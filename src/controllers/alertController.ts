import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { pgPool, redisPool } from '../config/db.js';
import { subscribeToSymbol, normalizeSymbol } from '../services/coinbase.js';

const redis = redisPool;

export async function createAlertHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { user_id, symbol, target_price, condition } = req.body;

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

    const priceNum = parseFloat(target_price);
    if (isNaN(priceNum) || priceNum <= 0) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'target_price must be a positive number',
      });
    }

    // Automatically ensure the device user exists in the database
    await pgPool.query(
      `INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
      [user_id]
    );

    const formattedSymbol = normalizeSymbol(symbol);
    const redisSymbol = formattedSymbol.replace('/', '');

    const insertQuery = `
      INSERT INTO price_alerts (user_id, symbol, target_price, condition, status, is_triggered)
      VALUES ($1, $2, $3, $4, 'ACTIVE', false)
      RETURNING id, user_id, symbol, target_price, condition, status, is_triggered, created_at
    `;

    const result = await pgPool.query(insertQuery, [
      user_id,
      formattedSymbol,
      priceNum,
      normalizedCondition,
    ]);

    const newAlert = result.rows[0];

    const redisKey = `alerts:${normalizedCondition}:${redisSymbol}`;
    await redis.zadd(redisKey, priceNum, newAlert.id);

    subscribeToSymbol(symbol);

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Price alert created and indexed successfully',
      data: newAlert,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAlertsHandler(req: Request, res: Response, next: NextFunction) {
  const { user_id } = req.query;
  try {
    const result = await pgPool.query(
      'SELECT * FROM price_alerts WHERE user_id = $1 ORDER BY created_at DESC',
      [user_id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function deleteAlertHandler(req: Request, res: Response, next: NextFunction) {
  const { id }: any = req.params;
  const { user_id } = req.body;
  try {
    const alertRes = await pgPool.query('SELECT * FROM price_alerts WHERE id = $1 AND user_id = $2', [id, user_id]);
    if (alertRes.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found or unauthorized' });
    }
    const alert = alertRes.rows[0];
    const redisSymbol = alert.symbol.replace('/', '');
    const redisKey = `alerts:${alert.condition}:${redisSymbol}`;

    await redis.zrem(redisKey, id);
    await pgPool.query('DELETE FROM price_alerts WHERE id = $1 AND user_id = $2', [id, user_id]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function updateAlertHandler(req: Request, res: Response, next: NextFunction) {
  const { id }: any = req.params;
  const { target_price, condition, user_id } = req.body;
  try {
    const oldRes = await pgPool.query('SELECT * FROM price_alerts WHERE id = $1 AND user_id = $2', [id, user_id]);
    if (oldRes.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found or unauthorized' });
    }
    const oldAlert = oldRes.rows[0];
    const oldRedisKey = `alerts:${oldAlert.condition}:${oldAlert.symbol.replace('/', '')}`;
    await redis.zrem(oldRedisKey, id);

    const newCondition = condition ? condition.toUpperCase() : oldAlert.condition;
    const newPrice = target_price !== undefined ? parseFloat(target_price) : oldAlert.target_price;

    const result = await pgPool.query(
      'UPDATE price_alerts SET target_price = $1, condition = $2, is_triggered = false, status = $3 WHERE id = $4 RETURNING *',
      [newPrice, newCondition, 'ACTIVE', id]
    );

    const updatedAlert = result.rows[0];
    const newRedisKey = `alerts:${newCondition}:${updatedAlert.symbol.replace('/', '')}`;
    await redis.zadd(newRedisKey, newPrice, id);

    res.json(updatedAlert);
  } catch (err) {
    next(err);
  }
}