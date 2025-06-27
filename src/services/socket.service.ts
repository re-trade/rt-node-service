import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { Message, Room, User } from '../types/index.js';
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../types/socket.types.js';
import ChatService from './chat.service.js';
import VideoService from './video.service.js';

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
let chatService: ChatService;
let videoService: VideoService;

export function createSocketService(httpServer: HttpServer, corsOrigin: string) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
    },
  });

  chatService = new ChatService(io);
  videoService = new VideoService(io);

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

    socket.on('authenticate', userData => chatService.handleAuthenticate(socket, userData));

    socket.on('sendMessage', data => chatService.handleSendMessage(socket, data));

    socket.on('joinRoom', roomId => chatService.handleJoinRoom(socket, roomId));

    socket.on('leaveRoom', roomId => chatService.handleLeaveRoom(socket, roomId));

    socket.on('createRoom', data => chatService.handleCreateRoom(socket, data));

    socket.on('typing', data => chatService.handleTyping(socket, data));

    socket.on('markMessageRead', messageId => chatService.handleMarkMessageRead(socket, messageId));

    socket.on('initiateCall', data => videoService.handleInitiateCall(socket, data));

    socket.on('acceptCall', data => videoService.handleAcceptCall(socket, data));

    socket.on('rejectCall', data => {
      const roomId = videoService.getRoomIdForUser(data.callerId);
      if (roomId) {
        videoService.handleRejectCall(socket, { ...data, roomId });
      } else {
        socket.emit('error', { message: 'No active call found', code: 'NO_ACTIVE_CALL' });
      }
    });

    socket.on('endCall', data => videoService.handleEndCall(socket, data));

    socket.on('signal', signal => videoService.handleSignaling(socket, signal));

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.id}`);
      await chatService.handleDisconnect(socket);

      if (socket.data.activeCall) {
        await videoService.handleEndCall(socket, { roomId: socket.data.activeCall.roomId });
      }
    });
  });
}

export async function getOnlineUsers(): Promise<User[]> {
  return await chatService.getOnlineUsers();
}

export async function getRooms(): Promise<Room[]> {
  return await chatService.getRooms();
}

export async function getRoomMessages(roomId: string, limit = 50, offset = 0): Promise<Message[]> {
  return await chatService.getRoomMessages(roomId, limit, offset);
}

export function getVideoService(): VideoService {
  return videoService;
}

export function getChatService(): ChatService {
  return chatService;
}
