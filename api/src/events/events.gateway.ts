import { WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';

const allowedOrigins = [
  'http://localhost',
  'http://localhost:80',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1',
  'http://127.0.0.1:80',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  // Support comma-separated list in FRONTEND_ORIGIN, e.g. "https://sinbarreras.gzakgroup.com,https://www.sinbarreras.gzakgroup.com"
  ...(process.env.FRONTEND_ORIGIN?.trim()
    ? process.env.FRONTEND_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : []),
].filter((origin): origin is string => Boolean(origin));

// UUID v4 pattern — clients can only subscribe to valid scan IDs
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@WebSocketGateway({
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly authService: AuthService) {}

  @WebSocketServer() server!: Server;

  afterInit(_server: Server) {
    console.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    // Allow all connections — room-based authorization per scanId (UUIDs are non-guessable)
    // Optionally authenticate for user-scoped rooms
    const rawToken = client.handshake.auth?.token || client.handshake.headers.authorization;
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
    const normalizedToken = typeof token === 'string' ? token.replace(/^Bearer\s+/i, '').trim() : '';

    if (normalizedToken) {
      try {
        const session = await this.authService.validateSessionToken(normalizedToken);
        if (session) {
          client.data.userId = session.user.id;
          client.join(`user-${session.user.id}`);
        }
      } catch {
        // Non-fatal: client gets scan-room events without user room
      }
    }
  }

  handleDisconnect(client: Socket) {
    void client; // cleanup handled by socket.io
  }

  // Client subscribes to a specific scan room by UUID
  @SubscribeMessage('watch-scan')
  handleWatchScan(@MessageBody() scanId: string, @ConnectedSocket() client: Socket) {
    if (typeof scanId === 'string' && UUID_RE.test(scanId)) {
      client.join(`scan-${scanId}`);
    }
  }

  @SubscribeMessage('unwatch-scan')
  handleUnwatchScan(@MessageBody() scanId: string, @ConnectedSocket() client: Socket) {
    if (typeof scanId === 'string' && UUID_RE.test(scanId)) {
      client.leave(`scan-${scanId}`);
    }
  }

  // Called by ScanEventsListener when BullMQ reports job completed
  emitScanCompleted(jobId: string, scanId: string) {
    // Emit to the scan-specific room (no auth needed — UUID is the capability token)
    this.server.to(`scan-${scanId}`).emit('scan-completed', { scanId });
    // Also emit to legacy 'authorized' room for backwards compat
    this.server.to('authorized').emit('scan-completed', { jobId, scanId });
  }

  emitProgress(scanId: string, progress: number) {
    this.server.to(`scan-${scanId}`).emit('scan-progress', { scanId, progress });
  }
}
