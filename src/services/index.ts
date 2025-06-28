import fs from 'fs';
import { Server as HttpServer } from 'http';
import path from 'path';
import { Server as SocketIOServer, Socket } from 'socket.io';

import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../types/index.js';
import type { SignalData } from '../types/webrtc.types.js';

import ChatService from './chat.service.js';
import VideoService from './video.service.js';
import { createWebRTCService } from './webrtc.service.js';

const RECORDINGS_DIR = path.join(process.cwd(), 'recordings');

const configChatIo = (
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  chatService: ChatService
) => {
  socket.on('authenticate', data => chatService.handleAuthenticate(socket, data));
  socket.on('joinRoom', roomId => chatService.handleJoinRoom(socket, roomId));
  socket.on('leaveRoom', roomId => chatService.handleLeaveRoom(socket, roomId));
  socket.on('sendMessage', data => chatService.handleSendMessage(socket, data));
  socket.on('typing', data => chatService.handleTyping(socket, data));
  socket.on('markMessageRead', data => chatService.handleMarkMessageRead(socket, data));
  socket.on('disconnect', () => chatService.handleDisconnect(socket));
};

export function createSocketService(httpServer: HttpServer, corsOrigin: string) {
  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST', 'PATCH'],
    },
  });

  if (!fs.existsSync(RECORDINGS_DIR)) {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
  }

  const chatService = new ChatService(io);
  const videoService = new VideoService(io);
  const webRTCService = createWebRTCService(io);

  io.on('connection', socket => {
    console.log(`User connected: ${socket.id}`);

    configChatIo(socket, chatService);

    socket.on('initiateCall', data => videoService.handleInitiateCall(socket, data));
    socket.on('acceptCall', data => videoService.handleAcceptCall(socket, data));
    socket.on('rejectCall', async data => {
      const roomId = videoService.getRoomIdForUser(data.callerId);
      if (roomId) {
        await videoService.handleRejectCall(socket, { ...data, roomId });
      } else {
        socket.emit('error', { message: 'No active call found', code: 'NO_ACTIVE_CALL' });
      }
    });
    socket.on('endCall', data => videoService.handleEndCall(socket, data));

    socket.on('join-call', data => {
      const room = webRTCService.getActiveRooms().find(r => r.id === data.roomId);
      if (room) webRTCService.createRoom(2);
      socket.join(data.roomId);
      socket.to(data.roomId).emit('user-joined-call', { userId: data.userId, roomId: data.roomId });
    });
    socket.on('leave-call', data => {
      socket.leave(data.roomId);
      socket.to(data.roomId).emit('user-left-call', { userId: data.userId, roomId: data.roomId });
    });
    socket.on('signal', (data: SignalData) => {
      socket.to(data.to).emit('signal', {
        from: socket.id,
        type: data.type,
        data: data.data,
        roomId: data.roomId,
      });
    });
  });

  return {
    io,
    chatService,
    videoService,
    webRTCService,
  };
}
