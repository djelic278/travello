import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { Express } from 'express';

// Store connected clients with their user IDs
const clients = new Map<number, Set<WebSocket>>();

export function setupWebSocket(server: Server, app: Express) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    // Skip vite HMR connections
    if (request.headers['sec-websocket-protocol'] === 'vite-hmr') {
      return;
    }

    // @ts-ignore - session types
    app.getSession(request, {}, () => {
      // @ts-ignore - session types
      if (!request.session?.passport?.user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    });
  });

  wss.on('connection', (ws, request) => {
    // @ts-ignore - session types
    const userId = request.session?.passport?.user;
    
    // Add client to the clients map
    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    clients.get(userId)?.add(ws);

    ws.on('close', () => {
      // Remove client from the clients map
      clients.get(userId)?.delete(ws);
      if (clients.get(userId)?.size === 0) {
        clients.delete(userId);
      }
    });
  });

  return {
    sendNotification: (userId: number, notification: any) => {
      const userClients = clients.get(userId);
      if (userClients) {
        const message = JSON.stringify({
          type: 'notification',
          data: notification
        });
        userClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      }
    }
  };
}
