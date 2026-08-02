import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

let wss: WebSocketServer;

export function initWebSocketServer(server: Server) {
  // 1. Pass noServer: true to prevent auto-attaching duplicate upgrade listeners
  wss = new WebSocketServer({ noServer: true });

  // 2. Explicitly handle the HTTP 'upgrade' event on the server
  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  // 3. Handle new client connections
  wss.on('connection', (ws) => {
    console.log('💻 Web Dashboard client connected!');

    ws.send(
      JSON.stringify({
        type: 'SYSTEM',
        message: 'Connected to Financial Engine WebSockets',
      })
    );
  });
}

export function broadcastToClients(data: object) {
  if (!wss) return;

  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}