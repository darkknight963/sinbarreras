import { WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

const allowedOrigins = [
  'http://localhost',
  'http://localhost:80',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1',
  'http://127.0.0.1:80',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  process.env.FRONTEND_ORIGIN?.trim(),
].filter((origin): origin is string => Boolean(origin));

@WebSocketGateway({
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  afterInit(server: Server) {
    console.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    const configuredToken = process.env.API_AUTH_TOKEN?.trim();
    const rawToken = client.handshake.auth?.token || client.handshake.headers.authorization;
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
    const normalizedToken = typeof token === 'string' ? token.replace(/^Bearer\s+/i, '').trim() : '';

    if (!configuredToken) {
      if (process.env.NODE_ENV === 'production') {
        client.disconnect(true);
        return;
      }

      client.join('authorized');
      console.log(`Client connected: ${client.id}`);
      return;
    }

    if (configuredToken && normalizedToken !== configuredToken) {
      client.emit('error', 'Unauthorized');
      client.disconnect(true);
      return;
    }

    client.join('authorized');

    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  emitProgress(scanId: string, progress: number) {
    this.server.to('authorized').emit('scan-progress', { scanId, progress });
  }

  emitScanCompleted(jobId: string, scanId: string) {
    this.server.to('authorized').emit('scan-completed', { jobId, scanId });
  }
}
