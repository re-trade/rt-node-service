import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../configs/prisma.js';
import { redisClient } from '../configs/redis.js';
import { Message, Room } from '../types/index.js';
import {
  ClientToServerEvents,
  InterServerEvents,
  OnlineUser,
  ServerToClientEvents,
  SocketData,
} from '../types/socket.types.js';

import { AuthService } from './auth.service.js';

import { JwtTokenType } from '../types/jwt.types.js';
import { getCookieMap } from '../utils/cookie.util.js';

class ChatService {
  private io: SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >;
  private authService: AuthService;

  constructor(io: SocketIOServer, authService: AuthService) {
    this.io = io;
    this.authService = authService;
  }

  async handleAuthenticate(
    socket: any,
    data: { token?: string; senderType: 'customer' | 'seller' }
  ) {
    try {
      const token = this.extractToken(socket, data);
      const user = await this.getUserProfile(token, data.senderType);
      if (!user) {
        return this.emitAuthError(socket, 'Invalid token');
      }

      const onlineUser = this.toOnlineUser(user, data.senderType);

      await this.setUserData(onlineUser);
      socket.data.user = onlineUser;
      socket.data.rooms = new Set();

      socket.broadcast.emit('userJoined', onlineUser);
      const users = await this.getOnlineUsers();
      socket.emit('onlineUsers', users);
    } catch (error) {
      console.error('Error authenticating user:', error);
      this.emitAuthError(socket, 'Invalid token');
    }
  }

  async handleSendMessage(socket: any, data: { content: string; roomId: string }) {
    if (!socket.data.user || !socket.data.rooms.has(data.roomId)) {
      socket.emit('error', { message: 'Unauthorized or not in room', code: 'AUTH_ERROR' });
      return;
    }

    const message = await this.createMessage(socket.data.user.id, data);
    await this.cacheMessage(data.roomId, message);
    this.io.to(data.roomId).emit('message', message);
  }

  async handleJoinRoom(socket: any, roomId: string) {
    if (!socket.data.user) {
      socket.emit('error', { message: 'User not authenticated' });
      return;
    }

    const room = await this.getRoomById(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    await this.addUserToRoom(socket, room);
    const recentMessages = await this.getRoomMessages(roomId);
    recentMessages.forEach(message => socket.emit('message', message));
  }

  async handleCreateRoom(
    socket: any,
    data: { name: string; customerId: string; sellerId: string }
  ) {
    if (!socket.data.user) {
      socket.emit('error', { message: 'User not authenticated' });
      return;
    }

    const room = await this.createOrGetRoom(data);
    await this.addUserToRoom(socket, room);
    socket.emit('roomCreated', room);
  }

  async handleLeaveRoom(socket: any, roomId: string) {
    if (!socket.data.user) return;

    await this.removeUserFromRoom(socket, roomId);
    socket.to(roomId).emit('userLeft', socket.data.user);
    socket.emit('roomLeft', roomId);
  }

  handleTyping(socket: any, data: { roomId: string; isTyping: boolean }) {
    if (!socket.data.user || !socket.data.rooms.has(data.roomId)) return;

    socket.to(data.roomId).emit('typing', {
      userId: socket.data.user.id,
      username: socket.data.user.username,
      isTyping: data.isTyping,
    });
  }

  async handleDisconnect(socket: any) {
    if (!socket.data.user) return;

    await this.handleUserDisconnect(socket);
  }

  async getOnlineUsers(): Promise<OnlineUser[]> {
    const userIds = await redisClient.sMembers('onlineUsers');
    return this.getOnlineUsersById(userIds);
  }

  async getRooms(): Promise<Room[]> {
    const rooms = await prisma.room.findMany({
      include: {
        messages: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    if (rooms.length === 0) return [];
    return Promise.all(
      rooms.map(async room => ({
        id: room.id,
        createdAt: room.createdAt,
        isPrivate: room.privated,
        updatedAt: room.updatedAt,
        sellerId: room.sellerId,
        customerId: room.customerId,
        participants: await this.getRoomParticipants(room.id),
        messages: room.messages,
      }))
    );
  }

  async getRoomMessages(roomId: string, limit = 50, offset = 0): Promise<Message[]> {
    if (offset === 0) {
      const cached = await redisClient.lRange(`room:${roomId}:messages`, 0, limit - 1);
      if (cached.length > 0) {
        return cached.map(raw => JSON.parse(raw));
      }
    }

    const messages = await prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    if (offset === 0 && messages.length > 0) {
      for (const msg of messages) {
        await redisClient.lPush(`room:${roomId}:messages`, JSON.stringify(msg));
      }
      await redisClient.lTrim(`room:${roomId}:messages`, 0, 999);
    }
    return messages;
  }

  private async setUserData(user: OnlineUser) {
    await redisClient.set(`user:${user.id}`, JSON.stringify(user));
    await redisClient.sAdd('onlineUsers', user.id);
  }

  private async createMessage(
    senderId: string,
    data: { content: string; roomId: string }
  ): Promise<Message> {
    return prisma.message.create({
      data: {
        content: data.content,
        roomId: data.roomId,
        senderId: senderId,
      },
    });
  }

  private async cacheMessage(roomId: string, message: Message) {
    await redisClient.lPush(`room:${roomId}:messages`, JSON.stringify(message));
    await redisClient.lTrim(`room:${roomId}:messages`, 0, 999);
  }

  private async getRoomById(roomId: string): Promise<Room | null> {
    const cached = await redisClient.get(`room:${roomId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Room;
        parsed.participants = await this.getRoomParticipants(roomId);
        return parsed;
      } catch {}
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { messages: true },
    });

    if (!room) return null;

    const result = {
      ...room,
      participants: await this.getRoomParticipants(roomId),
      isPrivate: room.privated,
    };

    await redisClient.set(`room:${roomId}`, JSON.stringify(result), { EX: 60 * 5 }); // 5 min TTL
    return result;
  }

  private async getUserProfile(token: string, senderType: 'customer' | 'seller') {
    if (senderType === 'customer') {
      return await this.authService.getCustomerProfile(token, JwtTokenType.ACCESS_TOKEN);
    }
    return await this.authService.getSellerProfile(token, JwtTokenType.ACCESS_TOKEN);
  }

  private toOnlineUser(user: any, senderType: 'customer' | 'seller'): OnlineUser {
    return {
      id: senderType === 'customer' ? user.customerId : user.sellerId,
      username: user.username,
      role: user.roles,
      senderRole: senderType,
      avatarUrl: user.avatarUrl,
      isOnline: true,
    };
  }

  private extractToken(socket: any, data: { token?: string }): string {
    if (data.token) return data.token;

    const cookies = getCookieMap(socket.request);
    return cookies?.[JwtTokenType.ACCESS_TOKEN] ?? '';
  }

  private emitAuthError(socket: any, message: string) {
    socket.emit('error', { message, code: 'INVALID_TOKEN' });
  }

  private async createOrGetRoom(data: { customerId: string; sellerId: string }): Promise<Room> {
    const [sid, cid] =
      data.sellerId < data.customerId
        ? [data.sellerId, data.customerId]
        : [data.customerId, data.sellerId];
    const key = `room:between:${cid}:${sid}`;

    const cachedRoomId = await redisClient.get(key);
    if (cachedRoomId) {
      return (await this.getRoomById(cachedRoomId)) as Room;
    }

    const existingRoom = await prisma.room.findFirst({
      where: { customerId: cid, sellerId: sid },
    });

    if (existingRoom) {
      await redisClient.set(key, existingRoom.id, { EX: 60 * 10 });
      return {
        ...existingRoom,
        participants: [],
        isPrivate: existingRoom.privated,
      };
    }

    const room = await prisma.room.create({
      data: { sellerId: sid, customerId: cid, privated: true },
      include: { messages: true },
    });

    await redisClient.set(key, room.id, { EX: 60 * 10 });
    return {
      ...room,
      participants: [],
      isPrivate: room.privated,
    };
  }

  private async addUserToRoom(socket: any, room: Room) {
    socket.join(room.id);
    socket.data.rooms.add(room.id);
    await redisClient.sAdd(`room:${room.id}:participants`, socket.data.user.id);
    socket.emit('roomJoined', room);
    socket.to(room.id).emit('userJoined', socket.data.user);
  }

  private async removeUserFromRoom(socket: any, roomId: string) {
    socket.leave(roomId);
    socket.data.rooms.delete(roomId);
    await redisClient.sRem(`room:${roomId}:participants`, socket.data.user.id);
  }

  private async handleUserDisconnect(socket: any) {
    await redisClient.sRem('onlineUsers', socket.data.user.id);

    for (const roomId of socket.data.rooms) {
      await this.removeUserFromRoom(socket, roomId);
      socket.to(roomId).emit('userLeft', socket.data.user);
    }

    socket.broadcast.emit('userLeft', socket.data.user);
  }

  private async getRoomParticipants(roomId: string): Promise<OnlineUser[]> {
    const participantIds = await redisClient.sMembers(`room:${roomId}:participants`);
    return this.getOnlineUsersById(participantIds);
  }

  private async getOnlineUsersById(ids: string[]): Promise<OnlineUser[]> {
    const pipeline = redisClient.multi();
    for (const userId of ids) {
      pipeline.get(`user:${userId}`);
    }
    const rawResults = await pipeline.exec();
    if (!Array.isArray(rawResults)) {
      return [];
    }
    const users: OnlineUser[] = [];
    for (const result of rawResults) {
      const json = result as unknown as string | null;
      if (!json) continue;
      try {
        const user = JSON.parse(json) as OnlineUser;
        users.push(user);
      } catch {}
    }
    return users;
  }

  async handleMarkMessageRead(socket: any, data: { messageId: string; roomId: string }) {
    if (!socket.data.user || !socket.data.rooms.has(data.roomId)) {
      socket.emit('error', { message: 'Unauthorized or not in room', code: 'AUTH_ERROR' });
      return;
    }

    try {
      await redisClient.sAdd(`message:${data.messageId}:read_by`, socket.data.user.id);
      const readByUsers = await redisClient.sMembers(`message:${data.messageId}:read_by`);
      this.io.to(data.roomId).emit('messageRead', {
        messageId: data.messageId,
        userId: socket.data.user.id,
        readBy: readByUsers,
        roomId: data.roomId,
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
      socket.emit('error', { message: 'Failed to mark message as read', code: 'DB_ERROR' });
    }
  }
}

export default ChatService;
