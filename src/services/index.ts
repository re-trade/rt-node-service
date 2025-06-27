import fs from 'fs';
import { Server as HttpServer } from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '../types/index.js';

import ChatService from './chat.service.js';
import VideoService from './video.service.js';

const RECORDINGS_DIR = path.join(process.cwd(), 'recordings');

export function createSocketService(httpServer: HttpServer, corsOrigin: string) {
  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
    },
  });

  if (!fs.existsSync(RECORDINGS_DIR)) {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
  }

  const chatService = new ChatService(io);
  const videoService = new VideoService(io);

  io.on('connection', socket => {
    console.log(`User connected: ${socket.id}`);

    socket.on('authenticate', data => chatService.handleAuthenticate(socket, data));
    socket.on('joinRoom', roomId => chatService.handleJoinRoom(socket, roomId));
    socket.on('leaveRoom', roomId => chatService.handleLeaveRoom(socket, roomId));
    socket.on('sendMessage', data => chatService.handleSendMessage(socket, data));
    socket.on('typing', data => chatService.handleTyping(socket, data));
    socket.on('markMessageRead', data => chatService.handleMarkMessageRead(socket, data));
    socket.on('disconnect', () => chatService.handleDisconnect(socket));

    socket.on('initiateCall', data => videoService.handleInitiateCall(socket, data));
    socket.on('acceptCall', data => videoService.handleAcceptCall(socket, data));
    socket.on('rejectCall', data => videoService.handleRejectCall(socket, data));
    socket.on('endCall', data => videoService.handleEndCall(socket, data));
    socket.on('signal', signal => videoService.handleSignaling(socket, signal));
  });

  return {
    io,
    chatService,
    videoService,
  };
}

export { default as ChatService } from './chat.service.js';
export { default as VideoService } from './video.service.js';
