import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { eventQueue } from './queue.js';
import { pgPool } from './config/db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { createAlertHandler } from './alerts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ---------------------------------------------------------------------------
// 1. HTTP ENDPOINTS
// ---------------------------------------------------------------------------

app.post('/api/v1/alerts', createAlertHandler);

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

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../public')));

// Global Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Global Server Error:', err.stack);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected system error occurred.',
  });
});

// ---------------------------------------------------------------------------
// 2. HELPER: FETCH REAL-TIME STATS
// ---------------------------------------------------------------------------
async function getSystemStats() {
  const waitingCount = await eventQueue.getWaitingCount();
  const activeCount = await eventQueue.getActiveCount();
  const completedCount = await eventQueue.getCompletedCount();
  const failedCount = await eventQueue.getFailedCount();

  const dbResult = await pgPool.query('SELECT COUNT(*) FROM market_events');
  const totalDbRows = parseInt(dbResult.rows[0].count, 10);

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

// ---------------------------------------------------------------------------
// 3. WEBSOCKET SERVER & BROADCAST LOOP
// ---------------------------------------------------------------------------
const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', async (ws: WebSocket) => {
  console.log('🔌 New client connected to WebSockets!');

  // Send initial state immediately upon connection
  try {
    const initialStats = await getSystemStats();
    ws.send(JSON.stringify(initialStats));
  } catch (err) {
    console.error('Failed to send initial WS message:', err);
  }

  ws.on('close', () => {
    console.log('🔌 Client disconnected from WebSockets.');
  });
});

// Broadcast metrics to all connected WebSocket clients every 500ms
setInterval(async () => {
  if (wss.clients.size === 0) return; // Don't query if no clients are listening

  try {
    const stats = await getSystemStats();
    const payload = JSON.stringify(stats);

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  } catch (err) {
    console.error('Error broadcasting WS stats:', err);
  }
}, 500);

// Start Server
server.listen(PORT, () => {
  console.log(`⚡ Express API Gateway running on http://localhost:${PORT}`);
  console.log(`🔌 WebSockets server active on ws://localhost:${PORT}`);
});