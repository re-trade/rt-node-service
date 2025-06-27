import { prisma } from '../configs/prisma.js';
import { redisClient } from '../configs/redis.js';
import type { Message, Room, OnlineUser } from '../types/index.js';

class ChatModel {
  async createUser(userData: {
    username: string;
    email: string;
    name: string;
  }): Promise<OnlineUser> {
    const user = await prisma.user.upsert({
      where: { username: userData.username },
      update: {},
      create: userData,
    });

    return {
      ...user,
      isOnline: true,
    };
  }

  async setUserOnline(userId: string, userData: OnlineUser): Promise<void> {
    await redisClient.hSet(`user:${userId}`, {
      id: userData.id,
      username: userData.username,
      email: userData.email,
      name: userData.name,
    });
    await redisClient.sAdd('onlineUsers', userId);
  }

  async setUserOffline(userId: string): Promise<void> {
    await redisClient.sRem('onlineUsers', userId);
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

  async createRoom(name: string): Promise<Room> {
    const room = await prisma.room.create({
      data: { name },
      include: { messages: true },
    });

    return {
      ...room,
      participants: [],
      messages: room.messages || [],
    };
  }

  async getRooms(): Promise<Room[]> {
    const rooms = await prisma.room.findMany({
      include: { messages: true },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      rooms.map(async room => ({
        ...room,
        participants: await this.getRoomParticipants(room.id),
        messages: room.messages || [],
      }))
    );
  }

  async getRoomById(roomId: string): Promise<Room | null> {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { messages: true },
    });

    if (!room) return null;

    return {
      ...room,
      participants: await this.getRoomParticipants(room.id),
      messages: room.messages || [],
    };
  }

  async getRoomParticipants(roomId: string): Promise<OnlineUser[]> {
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

  async addParticipantToRoom(roomId: string, userId: string): Promise<void> {
    await redisClient.sAdd(`room:${roomId}:participants`, userId);
  }

  async removeParticipantFromRoom(roomId: string, userId: string): Promise<void> {
    await redisClient.sRem(`room:${roomId}:participants`, userId);
  }

  async createMessage(data: {
    content: string;
    roomId: string;
    senderId: string;
  }): Promise<Message> {
    const message = await prisma.message.create({
      data,
      include: { sender: true },
    });

    // Cache the message
    await redisClient.lPush(`room:${data.roomId}:messages`, JSON.stringify(message));
    await redisClient.lTrim(`room:${data.roomId}:messages`, 0, 999);

    return message;
  }

  async getRoomMessages(roomId: string, limit = 50, offset = 0): Promise<Message[]> {
    return await prisma.message.findMany({
      where: { roomId },
      include: { sender: true },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });
  }

  async clearRoomMessages(roomId: string): Promise<void> {
    await prisma.message.deleteMany({
      where: { roomId },
    });
    await redisClient.del(`room:${roomId}:messages`);
  }
}

export default new ChatModel();
