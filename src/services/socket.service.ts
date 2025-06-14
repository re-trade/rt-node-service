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

export class SocketService {
  private io: SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >;
  private users: Map<string, User> = new Map();
  private rooms: Map<string, Room> = new Map();
  private messages: Map<string, Message[]> = new Map();

  constructor(httpServer: HttpServer, corsOrigin: string) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: corsOrigin,
        methods: ['GET', 'POST'],
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', socket => {
      console.log(`User connected: ${socket.id}`);

      // Handle user authentication and setup
      socket.on('authenticate', (userData: { username: string; avatar?: string }) => {
        const user: User = {
          id: socket.id,
          username: userData.username,
          avatar: userData.avatar,
          isOnline: true,
        };

        this.users.set(socket.id, user);
        socket.data.user = user;
        socket.data.rooms = new Set();

        // Notify all clients about the new user
        socket.broadcast.emit('userJoined', user);

        // Send current online users to the new user
        socket.emit('onlineUsers', Array.from(this.users.values()));
      });

      // Handle joining a room
      socket.on('joinRoom', (roomId: string) => {
        if (!socket.data.user) {
          socket.emit('error', { message: 'User not authenticated' });
          return;
        }

        socket.join(roomId);
        socket.data.rooms.add(roomId);

        let room = this.rooms.get(roomId);
        if (!room) {
          room = {
            id: roomId,
            name: `Room ${roomId}`,
            participants: [],
            createdAt: new Date(),
            isPrivate: false,
          };
          this.rooms.set(roomId, room);
          this.messages.set(roomId, []);
        }

        // Add user to room participants if not already present
        if (!room.participants.find((p: any) => p.id === socket.data.user.id)) {
          room.participants.push(socket.data.user);
        }

        socket.emit('roomJoined', room);
        socket.to(roomId).emit('userJoined', socket.data.user);

        // Send recent messages to the user
        const roomMessages = this.messages.get(roomId) || [];
        roomMessages.slice(-50).forEach(message => {
          socket.emit('message', message);
        });
      });

      // Handle leaving a room
      socket.on('leaveRoom', (roomId: string) => {
        if (!socket.data.user) return;

        socket.leave(roomId);
        socket.data.rooms.delete(roomId);

        const room = this.rooms.get(roomId);
        if (room) {
          room.participants = room.participants.filter((p: any) => p.id !== socket.data.user.id);
          socket.to(roomId).emit('userLeft', socket.data.user);
        }

        socket.emit('roomLeft', roomId);
      });

      // Handle creating a new room
      socket.on('createRoom', (data: { name: string; isPrivate: boolean }) => {
        if (!socket.data.user) {
          socket.emit('error', { message: 'User not authenticated' });
          return;
        }

        const roomId = uuidv4();
        const room: Room = {
          id: roomId,
          name: data.name,
          participants: [socket.data.user],
          createdAt: new Date(),
          isPrivate: data.isPrivate,
        };

        this.rooms.set(roomId, room);
        this.messages.set(roomId, []);

        socket.join(roomId);
        socket.data.rooms.add(roomId);
        socket.emit('roomCreated', room);
      });

      // Handle sending messages
      socket.on('sendMessage', (data: { content: string; roomId: string }) => {
        if (!socket.data.user) {
          socket.emit('error', { message: 'User not authenticated' });
          return;
        }

        if (!socket.data.rooms.has(data.roomId)) {
          socket.emit('error', { message: 'You are not in this room' });
          return;
        }

        const message: Message = {
          id: uuidv4(),
          content: data.content,
          senderId: socket.data.user.id,
          senderUsername: socket.data.user.username,
          roomId: data.roomId,
          timestamp: new Date(),
          type: 'text',
        };

        // Store message
        const roomMessages = this.messages.get(data.roomId) || [];
        roomMessages.push(message);
        this.messages.set(data.roomId, roomMessages);

        // Broadcast message to all users in the room
        this.io.to(data.roomId).emit('message', message);
      });

      // Handle typing indicators
      socket.on('typing', (data: { roomId: string; isTyping: boolean }) => {
        if (!socket.data.user || !socket.data.rooms.has(data.roomId)) return;

        socket.to(data.roomId).emit('typing', {
          userId: socket.data.user.id,
          username: socket.data.user.username,
          isTyping: data.isTyping,
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);

        if (socket.data.user) {
          // Remove user from all rooms
          socket.data.rooms.forEach((roomId: any) => {
            const room = this.rooms.get(roomId);
            if (room) {
              room.participants = room.participants.filter(
                (p: any) => p.id !== socket.data.user.id
              );
              socket.to(roomId).emit('userLeft', socket.data.user);
            }
          });

          // Remove user from online users
          this.users.delete(socket.id);

          // Notify all clients about user leaving
          socket.broadcast.emit('userLeft', socket.data.user);
        }
      });
    });
  }

  public getIO(): SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  > {
    return this.io;
  }

  public getOnlineUsers(): User[] {
    return Array.from(this.users.values());
  }

  public getRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  public getRoomMessages(roomId: string): Message[] {
    return this.messages.get(roomId) || [];
  }
}
