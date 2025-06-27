import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  User,
  Message,
  Room,
} from '../types/socket.types.js';
import { redisClient } from '../configs/redis.js';
import { prisma } from '../configs/prisma.js';

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function createSocketService(httpServer: HttpServer, corsOrigin: string) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
    },
  });

  setupEventHandlers();

  return {
    io,
    getIO() {
      return io;
    },
  };
}

function setupEventHandlers(): void {
  io.on('connection', socket => {
    console.log(`User connected: ${socket.id}`);

    socket.on('authenticate', async (userData: { username: string; avatar?: string }) => {
      const user: User = {
        id: socket.id,
        username: userData.username,
        avatar: userData.avatar,
        isOnline: true,
      };

      await redisClient.hSet(`user:${user.id}`, {
        id: user.id,
        username: user.username,
        avatar: user.avatar || '',
      });
      await redisClient.sAdd('onlineUsers', user.id);

      socket.data.user = user;
      socket.data.rooms = new Set();

      socket.broadcast.emit('userJoined', user);

      const users = await getOnlineUsers();
      socket.emit('onlineUsers', users);
    });

    socket.on('joinRoom', async (roomId: string) => {
      if (!socket.data.user) {
        socket.emit('error', { message: 'User not authenticated' });
        return;
      }

      await prisma.room.upsert({
        where: { id: roomId },
        create: { id: roomId, name: `Room ${roomId}` },
        update: {},
      });

      socket.join(roomId);
      socket.data.rooms.add(roomId);

      await redisClient.sAdd(`room:${roomId}:participants`, socket.data.user.id);

      const room: Room = {
        id: roomId,
        name: `Room ${roomId}`,
        participants: [],
        createdAt: new Date(),
        isPrivate: false,
      };

      socket.emit('roomJoined', room);
      socket.to(roomId).emit('userJoined', socket.data.user);

      const recentMessages = await getRoomMessages(roomId, 50, 0);
      recentMessages.forEach(message => {
        socket.emit('message', message);
      });
    });

    socket.on('leaveRoom', async (roomId: string) => {
      if (!socket.data.user) return;

      socket.leave(roomId);
      socket.data.rooms.delete(roomId);

      await redisClient.sRem(`room:${roomId}:participants`, socket.data.user.id);
      socket.to(roomId).emit('userLeft', socket.data.user);
      socket.emit('roomLeft', roomId);
    });

    socket.on('createRoom', async (data: { name: string; isPrivate: boolean }) => {
      if (!socket.data.user) {
        socket.emit('error', { message: 'User not authenticated' });
        return;
      }

      const roomId = uuidv4();
      await prisma.room.create({
        data: {
          id: roomId,
          name: data.name,
        },
      });

      await redisClient.sAdd(`room:${roomId}:participants`, socket.data.user.id);

      socket.join(roomId);
      socket.data.rooms.add(roomId);

      const room: Room = {
        id: roomId,
        name: data.name,
        participants: [socket.data.user],
        createdAt: new Date(),
        isPrivate: data.isPrivate,
      };

      socket.emit('roomCreated', room);
    });

    socket.on('sendMessage', async (data: { content: string; roomId: string }) => {
      if (!socket.data.user) {
        socket.emit('error', { message: 'User not authenticated' });
        return;
      }

      if (!socket.data.rooms.has(data.roomId)) {
        socket.emit('error', { message: 'You are not in this room' });
        return;
      }

      const message = await prisma.message.create({
        data: {
          id: uuidv4(),
          content: data.content,
          roomId: data.roomId,
          senderId: socket.data.user.id,
        },
      });

      await redisClient.lPush(`room:${data.roomId}:messages`, JSON.stringify(message));
      await redisClient.lTrim(`room:${data.roomId}:messages`, 0, 999);

      const outMessage: Message = {
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        senderUsername: socket.data.user.username,
        roomId: message.roomId,
        timestamp: message.createdAt,
        type: 'text',
      };

      io.to(data.roomId).emit('message', outMessage);
    });

    socket.on('typing', (data: { roomId: string; isTyping: boolean }) => {
      if (!socket.data.user || !socket.data.rooms.has(data.roomId)) return;

      socket.to(data.roomId).emit('typing', {
        userId: socket.data.user.id,
        username: socket.data.user.username,
        isTyping: data.isTyping,
      });
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.id}`);

      if (socket.data.user) {
        await redisClient.sRem('onlineUsers', socket.data.user.id);

        for (const roomId of socket.data.rooms) {
          await redisClient.sRem(`room:${roomId}:participants`, socket.data.user.id);
          socket.to(roomId).emit('userLeft', socket.data.user);
        }

        socket.broadcast.emit('userLeft', socket.data.user);
      }
    });
  });
}

export async function getOnlineUsers(): Promise<User[]> {
  const userIds = await redisClient.sMembers('onlineUsers');
  const users = await Promise.all(
    userIds.map(async userId => {
      const userData = await redisClient.hGetAll(`user:${userId}`);
      return {
        id: userData.id,
        username: userData.username,
        avatar: userData.avatar,
        isOnline: true,
      } as User;
    })
  );
  return users;
}

export async function getRooms(): Promise<Room[]> {
  const cached = await redisClient.get('chat:rooms');
  if (cached) {
    return JSON.parse(cached);
  }

  const rooms = await prisma.room.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const roomsWithParticipants = await Promise.all(
    rooms.map(async room => {
      const participantIds = await redisClient.sMembers(`room:${room.id}:participants`);
      const participants = await Promise.all(
        participantIds.map(async userId => {
          const userData = await redisClient.hGetAll(`user:${userId}`);
          return {
            id: userData.id,
            username: userData.username,
            avatar: userData.avatar,
            isOnline: true,
          } as User;
        })
      );

      return {
        id: room.id,
        name: room.name,
        participants,
        createdAt: room.createdAt,
        isPrivate: false,
      } as Room;
    })
  );

  await redisClient.set('chat:rooms', JSON.stringify(roomsWithParticipants), { EX: 60 });
  return roomsWithParticipants;
}

export async function getRoomMessages(roomId: string, limit = 50, offset = 0): Promise<Message[]> {
  const cacheKey = `chat:room:${roomId}:messages:${limit}:${offset}`;
  const cached = await redisClient.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const messages = await prisma.message.findMany({
    where: { roomId },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit,
  });

  const formattedMessages = messages.reverse().map(msg => ({
    id: msg.id,
    content: msg.content,
    senderId: msg.senderId,
    senderUsername: '',
    roomId: msg.roomId,
    timestamp: msg.createdAt,
    type: 'text' as const,
  }));

  await redisClient.set(cacheKey, JSON.stringify(formattedMessages), { EX: 60 });
  return formattedMessages;
}
