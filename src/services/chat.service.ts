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

class ChatService {
  private io: SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >;
  private userRooms: Map<string, Set<string>>;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.userRooms = new Map();
  }

  async handleAuthenticate(
    socket: any,
    userData: { username: string; email: string; name: string }
  ) {
    const user = await prisma.user.upsert({
      where: { username: userData.username },
      update: {},
      create: {
        username: userData.username,
        email: userData.email,
        name: userData.name,
      },
    });

    const onlineUser: OnlineUser = {
      ...user,
      isOnline: true,
    };

    await this.setUserData(onlineUser);
    socket.data.user = onlineUser;
    socket.data.rooms = new Set();

    socket.broadcast.emit('userJoined', onlineUser);
    const users = await this.getOnlineUsers();
    socket.emit('onlineUsers', users);
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

  async handleCreateRoom(socket: any, data: { name: string }) {
    if (!socket.data.user) {
      socket.emit('error', { message: 'User not authenticated' });
      return;
    }

    const room = await this.createRoom(data);
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
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
    });

    return users.map(user => ({
      ...user,
      isOnline: true,
    }));
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
        name: room.name,
        createdAt: room.createdAt,
        isPrivate: room.isPrivate,
        updatedAt: room.updatedAt,
        participants: await this.getRoomParticipants(room.id),
        messages: room.messages,
      }))
    );
  }

  async getRoomMessages(roomId: string, limit = 50, offset = 0): Promise<Message[]> {
    return await prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });
  }

  private async setUserData(user: OnlineUser) {
    await redisClient.hSet(`user:${user.id}`, {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
    });
    await redisClient.sAdd('onlineUsers', user.id);
  }

  private async createMessage(
    senderId: string,
    data: { content: string; roomId: string }
  ): Promise<Message> {
    return await prisma.message.create({
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
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        messages: true,
      },
    });

    if (!room) return null;

    return {
      ...room,
      participants: await this.getRoomParticipants(roomId),
    };
  }

  private async createRoom(data: { name: string }): Promise<Room> {
    const room = await prisma.room.create({
      data: {
        name: data.name,
      },
      include: {
        messages: true,
      },
    });

    return {
      ...room,
      participants: [],
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
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: participantIds,
        },
      },
    });

    return users.map(user => ({
      ...user,
      isOnline: true,
    }));
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
