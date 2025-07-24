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

import { AuthService, CustomerProfileResponse, SellerProfileResponse } from './auth.service.js';
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

      const user =
        data.senderType === 'customer'
          ? await this.authService.getCustomerProfile(token, JwtTokenType.ACCESS_TOKEN)
          : await this.authService.getSellerProfile(token, JwtTokenType.ACCESS_TOKEN);

      if (!user) return this.emitAuthError(socket, 'Invalid token');

      const ChattingUser = this.toChattingUser(user, data.senderType);
      await this.cacheUser(ChattingUser);
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
    if (!receiverId) return;

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
      senderType: isSeller ? 'SELLER' : 'CUSTOMER',
    });
    message.sender = user;
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
  ) {
    if (!socket.data.user) {
      socket.emit('error', { message: 'User not authenticated', code: 'AUTH_ERROR' });
      return;
    }

    const myId = socket.data.user.id;
    const rooms = await prisma.room.findMany({
      where: {
        OR: [{ customerId: myId }, { sellerId: myId }],
      },
      orderBy: { updatedAt: 'desc' },
    });

    const result: Room[] = [];
    for (const room of rooms) {
      const participants = await this.getRoomParticipants(room.customerId, room.sellerId);
      result.push({
        ...room,
        isPrivate: room.privated,
        participants,
      });
    }

    socket.emit('rooms', result);
  }

  async getRoomMessages(roomId: string, limit = 50, offset = 0): Promise<Message[]> {
    let messages: Message[];
    if (offset === 0) {
      const cached = await redisClient.lRange(`room:${roomId}:messages`, 0, limit - 1);
      if (cached.length > 0) {
        messages = cached.map(raw => JSON.parse(raw));
      } else {
        messages = await prisma.message.findMany({
          where: { roomId },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });
        for (const msg of messages) {
          await redisClient.lPush(`room:${roomId}:messages`, JSON.stringify(msg));
        }
        await redisClient.lTrim(`room:${roomId}:messages`, 0, 999);
      }
    } else {
      messages = await prisma.message.findMany({
        where: { roomId },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      });
    }
    const result: Message[] = [];
    for (const msg of messages) {
      const chattingUser = await this.getOrFetchUser(
        msg.senderId,
        this.mapSenderType(msg.senderType)
      );
      result.push({
        ...msg,
        sender: this.toChattingUser(chattingUser, this.mapSenderType(msg.senderType)),
      });
    }

    return result;
  }

  private async getRoomById(roomId: string): Promise<Room | null> {
    const cached = await redisClient.get(`room:${roomId}`);
    if (cached) return JSON.parse(cached);

    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });
    if (!room) return null;

    const participants = await this.getRoomParticipants(room.customerId, room.sellerId);

    const result: Room = {
      ...room,
      isPrivate: room.privated,
      participants,
    };

    await redisClient.set(`room:${roomId}`, JSON.stringify(result), { EX: 300 });
    return result;
  }

  private async getRoomParticipants(customerId: string, sellerId: string): Promise<ChattingUser[]> {
    const users: ChattingUser[] = [];
    const ids: [string, 'customer' | 'seller'][] = [
      [customerId, 'customer'],
      [sellerId, 'seller'],
    ];

    for (const [id, type] of ids) {
      let raw = await redisClient.get(`user:${id}`);
      if (!raw) {
        try {
          const profile =
            type === 'customer'
              ? await this.authService.getCustomerById(id)
              : await this.authService.getSellerById(id);

          const chattingUser = this.toChattingUser(profile, type);
          await this.cacheUser(chattingUser);
          raw = JSON.stringify(chattingUser);
        } catch (e) {
          console.error(`Could not fetch user ${id} from gRPC`, e);
          continue;
        }
      }

      if (raw) users.push(JSON.parse(raw));
    }

    return users;
  }

  async handleMarkMessageRead(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    data: { messageId: string; receiverId: string }
  ) {
    if (!socket.data.user) {
      socket.emit('error', { message: 'Unauthorized', code: 'AUTH_ERROR' });
      return;
    }

    const user = socket.data.user;

    const isSeller = user.senderRole === 'seller';
    const room = await this.createOrGetRoom({
      sellerId: isSeller ? user.id : data.receiverId,
      customerId: isSeller ? data.receiverId : user.id,
    });

    if (!socket.data.rooms.has(room.id)) {
      socket.emit('error', { message: 'Not in room', code: 'AUTH_ERROR' });
      return;
    }

    try {
      await redisClient.sAdd(`message:${data.messageId}:read_by`, user.id);
      const readByUsers = await redisClient.sMembers(`message:${data.messageId}:read_by`);

      this.io.to(room.id).emit('messageRead', {
        messageId: data.messageId,
        userId: user.id,
        readBy: readByUsers,
        roomId: room.id,
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
      socket.emit('error', { message: 'Failed to mark message as read', code: 'DB_ERROR' });
    }
  }

  private async createOrGetRoom(data: { customerId: string; sellerId: string }): Promise<Room> {
    const key = `room:between:${data.customerId}:${data.sellerId}`;
    const { sellerId, customerId } = data;
    // validate user id
    await this.getOrFetchUser(customerId, 'customer');
    await this.getOrFetchUser(sellerId, 'seller');
    // Check rooms existed on redis before check on chat db
    const cachedRoomId = await redisClient.get(key);
    if (cachedRoomId) return (await this.getRoomById(cachedRoomId))!;
    // If not existed, then check on a database, if not will create new room and save to db
    const existingRoom = await prisma.room.findUnique({
      where: {
        sellerId_customerId: {
          sellerId,
          customerId,
        },
      },
    });

    if (existingRoom) {
      await redisClient.set(key, existingRoom.id, { EX: 600 });
      return (await this.getRoomById(existingRoom.id))!;
    }

    const room = await prisma.room.create({
      data: { sellerId, customerId, privated: true },
    });

    await redisClient.set(key, room.id, { EX: 600 });
    return (await this.getRoomById(room.id))!;
  }

  private mapSenderType(type: 'CUSTOMER' | 'SELLER'): 'seller' | 'customer' {
    return type.toLowerCase() as 'seller' | 'customer';
  }

  private async getOrFetchUser(
    accountId: string,
    type: 'customer' | 'seller'
  ): Promise<CustomerProfileResponse | SellerProfileResponse> {
    const raw = await redisClient.get(`user:${accountId}`);
    if (raw) return JSON.parse(raw);

    let user;
    if (type === 'customer') {
      user = await this.authService.getCustomerById(accountId);
    } else {
      user = await this.authService.getSellerById(accountId);
    }

    if (!user) throw new Error(`Invalid ${type} ID: ${accountId}`);

    const chattingUser = this.toChattingUser(user, type);
    await this.cacheUser(chattingUser);
    return user;
  }

  private async cacheUser(user: ChattingUser) {
    await redisClient.set(`user:${user.id}`, JSON.stringify(user));
    await redisClient.sAdd('ChattingUsers', user.id);
  }

  private async createMessage(
    senderId: string,
    data: { content: string; roomId: string; senderType: 'CUSTOMER' | 'SELLER' }
  ): Promise<Message> {
    return prisma.message.create({
      data: { content: data.content, roomId: data.roomId, senderId, senderType: data.senderType },
    });
  }

  private async cacheMessage(roomId: string, message: Message) {
    await redisClient.lPush(`room:${roomId}:messages`, JSON.stringify(message));
    await redisClient.lTrim(`room:${roomId}:messages`, 0, 999);
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

  private toChattingUser(
    user: CustomerProfileResponse | SellerProfileResponse,
    senderType: 'customer' | 'seller'
  ): ChattingUser {
    return {
      id: user.accountId,
      username: user.username,
      role: user.roles,
      senderRole: senderType,
      avatarUrl: user.avatarUrl,
      isOnline: true,
      name:
        senderType === 'customer'
          ? `${(user as CustomerProfileResponse).firstName} ${(user as CustomerProfileResponse).lastName}`
          : (user as SellerProfileResponse).sellerName,
    };
  }

  private async ensureUsersCached(customerId: string, sellerId: string) {
    for (const id of [customerId, sellerId]) {
      const cached = await redisClient.get(`user:${id}`);
      if (!cached) {
        let profile: CustomerProfileResponse | SellerProfileResponse | null = null;
        let senderType: 'customer' | 'seller';

        try {
          profile = await this.authService.getCustomerById(id);
          senderType = 'customer';
        } catch {
          profile = null;
        }

        if (!profile) {
          try {
            profile = await this.authService.getSellerById(id);
            senderType = 'seller';
          } catch {
            profile = null;
          }
        }

        if (profile) {
          const chattingUser = this.toChattingUser(profile, senderType!);
          await this.cacheUser(chattingUser);
        }
      }
    }
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
}

export default ChatService;
