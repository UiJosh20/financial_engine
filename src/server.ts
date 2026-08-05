import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { eventQueue } from './queue.js';
import { initializeDatabase, pgPool } from './config/db.js';
import apiRouter from './routes/api.js';
import { startMarketStream } from './services/coinbase.js';
import { initWebSocketServer, broadcastToClients } from './ws.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8000;

app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Financial Engine API is running' });
});

// Mount API routes
app.use('/api/v1', apiRouter);

app.post('/api/v1/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { event_type, symbol, price, payload } = req.body;

    if (!event_type || !symbol || !price) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Missing required fields: event_type, symbol, or price',
      });
    }

    const job = await eventQueue.add('INGEST_EVENT', {
      event_type,
      symbol,
      price: Number(price).toFixed(2),
      payload: payload || {},
    });

    return res.status(202).json({
      status: 'ACCEPTED',
      message: 'Event queued for processing',
      jobId: job.id,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/events/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getSystemStats();
    return res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
});

app.use(express.static(path.join(__dirname, '../public')));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Global Server Error:', err.stack);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected system error occurred.',
  });
});

export async function getSystemStats() {
  const waitingCount = await eventQueue.getWaitingCount();
  const activeCount = await eventQueue.getActiveCount();
  const completedCount = await eventQueue.getCompletedCount();
  const failedCount = await eventQueue.getFailedCount();

  let totalDbRows = 0;
  try {
    const dbResult = await pgPool.query('SELECT COUNT(*) FROM price_alerts');
    totalDbRows = parseInt(dbResult.rows[0].count, 10);
  } catch (err) {
    // Graceful fallback
  }

  return {
    timestamp: new Date().toISOString(),
    queue: {
      waiting: waitingCount,
      active: activeCount,
      completed: completedCount,
      failed: failedCount,
    },
    database: {
      totalRows: totalDbRows,
    },
  };
}

const server = createServer(app);



initWebSocketServer(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ Express API Gateway running on http://localhost:${PORT}`);
  console.log(`🔌 WebSockets server active on ws://localhost:${PORT}`);
  startMarketStream();
});


await initializeDatabase();



setInterval(async () => {
  try {
    const stats = await getSystemStats();
    broadcastToClients({ type: 'STATS', ...stats });
  } catch (err) {
    console.error('Error broadcasting WS stats:', err);
  }
}, 2000);

