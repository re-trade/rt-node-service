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
import { GrpcTokenServiceClient } from '../grpc/authentication.js';
import { configLoader } from '../configs/index.js';
import { credentials } from '@grpc/grpc-js';
import { AuthService } from './auth.service.js';

const RECORDINGS_DIR = path.join(process.cwd(), 'recordings');

const tokenGrpc = new GrpcTokenServiceClient(
  `${configLoader.config.MAIN_SERVICE_HOST}:${configLoader.config.MAIN_SERVICE_GRPC_PORT}`,
  credentials.createInsecure()
);

const authService = new AuthService(tokenGrpc);

export const configChatIo = (
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  chatService: ChatService
) => {
  socket.on('authenticate', data => chatService.handleAuthenticate(socket, data));
  socket.on('getRooms', () => chatService.getRooms(socket));
  socket.on('joinRoom', roomId => chatService.handleJoinRoom(socket, roomId));
  socket.on('leaveRoom', roomId => chatService.handleLeaveRoom(socket, roomId));
  socket.on('sendMessage', data => chatService.handleSendMessage(socket, data));
  socket.on('typing', data => chatService.handleTyping(socket, data));
  socket.on('markMessageRead', data => chatService.handleMarkMessageRead(socket, data));
  socket.on('disconnect', () => chatService.handleDisconnect(socket));
};

export const configVideoIo = (
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  videoService: VideoService,
  webRTCService: ReturnType<typeof createWebRTCService>
) => {
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
  socket.on('signal', (data: SignalData) => {
    socket.to(data.to).emit('signal', {
      from: socket.id,
      type: data.type,
      data: data.data,
      roomId: data.roomId,
    });
  });
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
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: true,
    },
  });

  if (!fs.existsSync(RECORDINGS_DIR)) {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
  }

  const chatService = new ChatService(io, authService);
  const videoService = new VideoService(io);
  const webRTCService = createWebRTCService(io);

  io.on('connection', socket => {
    console.log(`User connected: ${socket.id}`);

    configChatIo(socket, chatService);
    configVideoIo(socket, videoService, webRTCService);
  });

  return {
    io,
    chatService,
    videoService,
    webRTCService,
  };
}
