import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/',
})
@Injectable()
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // 1. Extract token from auth or headers
      let token = client.handshake.auth?.token;
      if (!token) {
        const authHeader = client.handshake.headers?.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }

      if (!token) {
        this.logger.warn(`Connection rejected: No token provided. Client ID: ${client.id}`);
        client.disconnect(true);
        return;
      }

      // 2. Verify JWT token
      const secret = this.configService.get<string>('JWT_ACCESS_SECRET') || process.env.JWT_ACCESS_SECRET;
      if (!secret) {
        this.logger.error('JWT_ACCESS_SECRET is not configured');
        client.disconnect(true);
        return;
      }
      const payload = this.jwtService.verify(token, { secret });
      
      const userId = payload.sub;
      if (!userId) {
        this.logger.warn(`Connection rejected: Invalid token payload. Client ID: ${client.id}`);
        client.disconnect(true);
        return;
      }

      // 3. Join Socket to a Room named exactly as the user's ID
      client.data.userId = userId;
      client.data.role = payload.role;
      
      client.join(userId);

      this.logger.log(`Client connected: User ID ${userId} (Socket ID: ${client.id}) joined room: ${userId}`);
      
      // Emit welcome event
      client.emit('connected', { userId, status: 'OK' });
    } catch (error: any) {
      this.logger.error(`Connection authentication failed: ${error.message}. Client ID: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.logger.log(`Client disconnected: User ID ${userId} (Socket ID: ${client.id}) left room: ${userId}`);
    }
  }

  /**
   * Send a real-time event to a specific user using Socket.IO Room broadcasting
   * This works across multiple servers when using Redis Adapter
   */
  sendToUser(userId: string, event: string, data: any): boolean {
    this.server.to(userId).emit(event, data);
    this.logger.debug(`Broadcasted event "${event}" to Room/User ID ${userId}`);
    return true; // We return true assuming the broadcast is dispatched via Redis.
  }

  /**
   * Broadcast an event to all connected clients across all servers
   */
  sendToAll(event: string, data: any) {
    this.server.emit(event, data);
    this.logger.debug(`Broadcasted event "${event}" to all connected clients`);
  }
}
