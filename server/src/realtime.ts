import { WebSocketGateway, WebSocketServer, OnGatewayConnection, SubscribeMessage, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from './auth';
import { SocialService } from './social.service';
import { Injectable } from '@nestjs/common';
import { MessageDto } from '@raahi/contracts';
import { clientOrigins } from './security';

@Injectable()
@WebSocketGateway({ cors: { origin: clientOrigins() } })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  constructor(private auth: AuthService, private social: SocialService) {}
  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (typeof token !== 'string') throw new Error();
      client.data.userId = await this.auth.authenticate(token);
      client.join(`user:${client.data.userId}`);
    } catch { client.disconnect(true); }
  }
  @SubscribeMessage('join') async join(@ConnectedSocket() client: Socket, @MessageBody() id: string) {
    try { await this.auth.authenticate(client.handshake.auth.token); await this.social.authorize(client.data.userId, id); client.join(`match:${id}`); return { ok: true }; }
    catch { return { ok: false }; }
  }
  @SubscribeMessage('leave') leave(@ConnectedSocket() client: Socket, @MessageBody() id: string) { client.leave(`match:${id}`); }
  @SubscribeMessage('typing') async typing(@ConnectedSocket() client: Socket, @MessageBody() id: string) {
    if (Date.now() - (client.data.lastTyping || 0) < 2000) return;
    client.data.lastTyping = Date.now();
    try { await this.auth.authenticate(client.handshake.auth.token); await this.social.authorize(client.data.userId, id); client.to(`match:${id}`).emit('typing', { conversationId: id, userId: client.data.userId }); } catch {}
  }
  async message(message: MessageDto) {
    const match = await this.social.db.match.findUnique({ where: { id: message.conversationId } });
    if (!match || match.ended || await this.social.blocked(match.userAId, match.userBId)) return;
    this.server.to(`user:${match.userAId}`).to(`user:${match.userBId}`).emit('message', message);
    const recipient = match.userAId === message.senderId ? match.userBId : match.userAId;
    const devices = await this.social.db.deviceToken.findMany({ where: { userId: recipient, enabled: true } });
    if (devices.length) fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(devices.map((d) => ({ to: d.token, title: 'New message', body: 'Your travel match sent you a message.', data: { matchId: match.id }, sound: 'default' }))) }).catch(() => undefined);
  }
  ended(id: string) { this.server.to(`match:${id}`).emit('ended', { conversationId: id }); this.server.in(`match:${id}`).socketsLeave(`match:${id}`); }
  disconnectUser(id: string) { this.server.in(`user:${id}`).disconnectSockets(true); }
}
