import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from '../configs/prisma.js';
import { redisClient } from '../configs/redis.js';
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../types/index.js';

import { ChattingUser, Message, Room } from '../types/chat.type.js';

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
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    data: { token?: string; senderType: 'customer' | 'seller' }
  ) {
    try {
      const token = this.extractToken(socket, data);
      const user = await this.getUserProfile(token, data.senderType);
      if (!user) return this.emitAuthError(socket, 'Invalid token');

      const ChattingUser = this.toChattingUser(user, data.senderType);
      await this.setUserData(ChattingUser);
      socket.data.user = ChattingUser;
      socket.data.rooms = new Set();
      socket.emit('authSuccess');
    } catch (error) {
      console.error('Error authenticating user:', error);
      this.emitAuthError(socket, 'Invalid token');
    }
  }

  async handleJoinRoom(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    receiverId: string
  ) {
    const user = socket.data.user;
    if (!user) {
      socket.emit('error', { message: 'User not authenticated', code: 'AUTH_ERROR' });
      return;
    }

    const isSeller = user.senderRole === 'seller';
    const room = await this.createOrGetRoom({
      sellerId: isSeller ? user.id : receiverId,
      customerId: isSeller ? receiverId : user.id,
    });

    for (const r of socket.rooms) {
      if (r !== socket.id) {
        socket.leave(r);
      }
    }
    socket.join(room.id);
    await this.addUserToRoom(socket, room);
    socket.emit('roomJoined', room);
    const recentMessages = await this.getRoomMessages(room.id);
    for (const msg of recentMessages) {
      socket.emit('message', msg);
    }
  }

  async handleSendMessage(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    data: { content: string; receiverId: string }
  ) {
    const user = socket.data.user;
    if (!user) {
      socket.emit('error', { message: 'Unauthorized', code: 'AUTH_ERROR' });
      return;
    }

    const isSeller = user.senderRole === 'seller';
    const room = await this.createOrGetRoom({
      sellerId: isSeller ? user.id : data.receiverId,
      customerId: isSeller ? data.receiverId : user.id,
    });

    if (!socket.data.rooms.has(room.id)) {
      socket.join(room.id);
      socket.data.rooms.add(room.id);
    }

    const message = await this.createMessage(user.id, {
      content: data.content,
      roomId: room.id,
    });

    await this.cacheMessage(room.id, message);
    this.io.to(room.id).emit('message', message);
  }

  async handleLeaveRoom(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    receiverId: string
  ) {
    const user = socket.data.user;
    if (!user) return;

    const isSeller = user.senderRole === 'seller';
    const room = await this.createOrGetRoom({
      sellerId: isSeller ? user.id : receiverId,
      customerId: isSeller ? receiverId : user.id,
    });

    await this.removeUserFromRoom(socket, room.id);
    socket.emit('roomLeft', room.id);
  }

  async handleTyping(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    data: { receiverId: string; isTyping: boolean }
  ) {
    if (!socket.data.user) return;
    const isSeller = socket.data.user.senderRole === 'seller';
    const room = await this.createOrGetRoom({
      sellerId: isSeller ? socket.data.user.id : data.receiverId,
      customerId: isSeller ? data.receiverId : socket.data.user.id,
    });

    socket.to(room.id).emit('typing', {
      userId: socket.data.user.id,
      username: socket.data.user.username,
      isTyping: data.isTyping,
    });
  }

  async handleDisconnect(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
  ) {
    if (!socket.data.user) return;

    await redisClient.sRem('ChattingUsers', socket.data.user.id);
    for (const roomId of socket.data.rooms) {
      await this.removeUserFromRoom(socket, roomId);
    }
  }

  async getRooms(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
  ): Promise<void> {
    if (!socket.data.user) {
      socket.emit('error', { message: 'User not authenticated', code: 'AUTH_ERROR' });
      return;
    }

    try {
      const myId = socket.data.user.id;
      const rooms = await prisma.room.findMany({
        where: {
          OR: [{ customerId: myId }, { sellerId: myId }],
        },
        include: { messages: true },
        orderBy: { updatedAt: 'desc' },
      });

      const result = await Promise.all(
        rooms.map(async room => {
          const tempRoom: Room = {
            id: room.id,
            createdAt: room.createdAt,
            updatedAt: room.updatedAt,
            isPrivate: room.privated,
            sellerId: room.sellerId,
            customerId: room.customerId,
            participants: await this.getRoomParticipants(room.id),
          };
          return tempRoom;
        })
      );

      socket.emit('rooms', result);
    } catch (err) {
      console.error('Failed to get rooms:', err);
      socket.emit('error', { message: 'Failed to get rooms', code: 'DB_ERROR' });
    }
  }

  async getRoomMessages(roomId: string, limit = 50, offset = 0): Promise<Message[]> {
    if (offset === 0) {
      const cached = await redisClient.lRange(`room:${roomId}:messages`, 0, limit - 1);
      if (cached.length > 0) return cached.map(raw => JSON.parse(raw));
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

  async handleMarkMessageRead(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    data: { messageId: string; roomId: string }
  ) {
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

  private async setUserData(user: ChattingUser) {
    await redisClient.set(`user:${user.id}`, JSON.stringify(user));
    await redisClient.sAdd('ChattingUsers', user.id);
  }

  private async createMessage(
    senderId: string,
    data: { content: string; roomId: string }
  ): Promise<Message> {
    return prisma.message.create({
      data: { content: data.content, roomId: data.roomId, senderId },
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
        return JSON.parse(cached) as Room;
      } catch {
        return null;
      }
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

    await redisClient.set(`room:${roomId}`, JSON.stringify(result), { EX: 60 * 5 });
    return result;
  }

  private async getUserProfile(token: string, senderType: 'customer' | 'seller') {
    return senderType === 'customer'
      ? this.authService.getCustomerProfile(token, JwtTokenType.ACCESS_TOKEN)
      : this.authService.getSellerProfile(token, JwtTokenType.ACCESS_TOKEN);
  }

  private toChattingUser(user: any, senderType: 'customer' | 'seller'): ChattingUser {
    return {
      id: senderType === 'customer' ? user.customerId : user.sellerId,
      username: user.username,
      role: user.roles,
      senderRole: senderType,
      avatarUrl: user.avatarUrl,
      isOnline: true,
      name: senderType === 'customer' ? `${user.firstName} ${user.lastName}` : user.sellerName,
    };
  }

  private extractToken(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    data: { token?: string }
  ): string {
    if (data.token) return data.token;
    const cookies = getCookieMap(socket.request);
    return cookies?.[JwtTokenType.ACCESS_TOKEN] ?? '';
  }

  private emitAuthError(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    message: string
  ) {
    socket.emit('error', { message, code: 'INVALID_TOKEN' });
  }

  private async createOrGetRoom(data: { customerId: string; sellerId: string }): Promise<Room> {
    const key = `room:between:${data.customerId}:${data.sellerId}`;
    const { sellerId, customerId } = data;
    const cachedRoomId = await redisClient.get(key);
    if (cachedRoomId) return (await this.getRoomById(cachedRoomId)) as Room;

    const existingRoom = await prisma.room.findUnique({
      where: {
        sellerId_customerId: {
          sellerId: sellerId,
          customerId: customerId,
        },
      },
    });
    if (existingRoom) {
      await redisClient.set(key, existingRoom.id, { EX: 60 * 10 });
      return { ...existingRoom, participants: [], isPrivate: existingRoom.privated };
    }

    const room = await prisma.room.create({
      data: { sellerId, customerId, privated: true },
      include: { messages: true },
    });

    await redisClient.set(key, room.id, { EX: 60 * 10 });
    return { ...room, participants: [], isPrivate: room.privated };
  }

  private async addUserToRoom(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    room: Room
  ) {
    if (!socket.data.user?.id) {
      socket.emit('error', { message: 'User not authenticated', code: 'AUTH_ERROR' });
      return;
    }
    socket.join(room.id);
    socket.data.rooms.add(room.id);
    await redisClient.sAdd(`room:${room.id}:participants`, socket.data.user.id);
    socket.emit('roomJoined', room);
  }

  private async removeUserFromRoom(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    roomId: string
  ) {
    if (!socket.data.user?.id) {
      socket.emit('error', { message: 'User not authenticated', code: 'AUTH_ERROR' });
      return;
    }
    socket.leave(roomId);
    socket.data.rooms.delete(roomId);
    await redisClient.sRem(`room:${roomId}:participants`, socket.data.user.id);
  }

  private async getRoomParticipants(roomId: string): Promise<ChattingUser[]> {
    const participantIds = await redisClient.sMembers(`room:${roomId}:participants`);
    return this.getChattingUsersById(participantIds);
  }

  private async getChattingUsersById(ids: string[]): Promise<ChattingUser[]> {
    const pipeline = redisClient.multi();
    for (const userId of ids) {
      pipeline.get(`user:${userId}`);
    }
    const rawResults = await pipeline.exec();
    if (!Array.isArray(rawResults)) return [];

    const users: ChattingUser[] = [];
    for (const result of rawResults) {
      const json = result as unknown as string | null;
      if (!json) continue;
      try {
        const user = JSON.parse(json) as ChattingUser;
        users.push(user);
      } catch {}
    }
    return users;
  }
}

export default ChatService;
