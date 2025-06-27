import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import {
  CallSession,
  PeerConnection,
  SignalData,
  WebRTCClientToServerEvents,
  WebRTCRoom,
  WebRTCServerToClientEvents,
} from '../types/webrtc.types.js';
import { RecordingChunk } from '../types/recording.types.js';
import { prisma } from '../configs/prisma.js';

let io: SocketIOServer<WebRTCClientToServerEvents, WebRTCServerToClientEvents>;
const rooms = new Map<string, WebRTCRoom>();
const activeCalls = new Map<string, CallSession>();
const peerConnections = new Map<string, PeerConnection>();
const recordingStreams = new Map<string, fs.WriteStream>();

export function createWebRTCService(socketIO: SocketIOServer) {
  io = socketIO;
  setupWebRTCHandlers();

  return {
    getActiveRooms: () => Array.from(rooms.values()).filter(room => room.isActive),
    getActiveCalls: () => Array.from(activeCalls.values()),
    getRoomParticipants: (roomId: string) => rooms.get(roomId)?.participants || [],
    isRoomActive: (roomId: string) => rooms.get(roomId)?.isActive || false,
    createRoom: (maxParticipants = 4) => {
      const roomId = uuidv4();
      const room: WebRTCRoom = {
        id: roomId,
        participants: [],
        maxParticipants,
        isActive: true,
        createdAt: new Date(),
      };
      rooms.set(roomId, room);
      return roomId;
    },
  };
}

function setupWebRTCHandlers(): void {
  io.on('connection', socket => {
    console.log(`WebRTC client connected: ${socket.id}`);

    socket.on('join-call', (data: { roomId: string; userId: string }) => {
      const { roomId, userId } = data;

      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('webrtc-error', { message: 'Room not found', code: 'ROOM_NOT_FOUND' });
        return;
      }

      if (room.participants.length >= room.maxParticipants) {
        socket.emit('room-full', { roomId });
        return;
      }

      const existingParticipants = Array.from(peerConnections.values())
        .filter(pc => pc.roomId === roomId)
        .map(pc => ({ socketId: pc.id, userId: pc.userId }));

      socket.emit('existing-participants', { participants: existingParticipants });

      if (!room.participants.includes(userId)) {
        room.participants.push(userId);
      }

      socket.join(roomId);

      const peerConnection: PeerConnection = {
        id: socket.id,
        userId,
        roomId,
        isInitiator: room.participants.length === 1,
        createdAt: new Date(),
      };

      peerConnections.set(socket.id, peerConnection);
      socket.to(roomId).emit('new-participant', { socketId: socket.id, userId });

      console.log(`User ${userId} joined call in room ${roomId}`);
    });

    socket.on('leave-call', (data: { roomId: string; userId: string }) => {
      const { roomId, userId } = data;
      handleUserLeaveCall(socket.id, roomId, userId);
    });

    socket.on('signal', (data: SignalData) => {
      const { to, roomId, type, data: payload } = data;
      io.to(to).emit('signal', {
        from: socket.id,
        type,
        data: payload,
        roomId,
      });

      console.log(`Signal (${type}) forwarded from ${socket.id} to ${to} in room ${roomId}`);
    });

    socket.on('start-call', async (data: { roomId: string; type: 'audio' | 'video' }) => {
      const { roomId, type } = data;
      const peerConnection = peerConnections.get(socket.id);

      if (!peerConnection) {
        socket.emit('webrtc-error', { message: 'Not connected to any room' });
        return;
      }

      const callSession: CallSession = {
        id: uuidv4(),
        roomId,
        participants: [peerConnection.userId],
        startTime: new Date(),
        type,
      };

      activeCalls.set(roomId, callSession);

      const recordingsDir = path.join(process.cwd(), 'recordings');
      if (!fs.existsSync(recordingsDir)) {
        fs.mkdirSync(recordingsDir, { recursive: true });
      }

      const filePath = path.join(recordingsDir, `${callSession.id}.webm`);
      const writeStream = fs.createWriteStream(filePath);
      recordingStreams.set(callSession.id, writeStream);

      await prisma.recording.create({
        data: {
          callSessionId: callSession.id,
          filePath,
          startTime: callSession.startTime,
        },
      });

      console.log(`Call started in room ${roomId} by ${peerConnection.userId}`);
    });

    socket.on('recording-chunk', (data: RecordingChunk) => {
      const writeStream = recordingStreams.get(data.callSessionId);
      if (writeStream) {
        const buffer = Buffer.from(data.chunk, 'base64');
        writeStream.write(buffer);
      }
    });

    socket.on('end-call', async (data: { roomId: string }) => {
      const { roomId } = data;
      await endCall(roomId);
      socket.to(roomId).emit('call-ended', { roomId });
      console.log(`Call ended in room ${roomId}`);
    });

    socket.on('disconnect', () => {
      console.log(`WebRTC client disconnected: ${socket.id}`);

      const peerConnection = peerConnections.get(socket.id);
      if (peerConnection) {
        handleUserLeaveCall(socket.id, peerConnection.roomId, peerConnection.userId);
      }
    });
  });
}

function handleUserLeaveCall(socketId: string, roomId: string, userId: string): void {
  const room = rooms.get(roomId);
  if (room) {
    room.participants = room.participants.filter(id => id !== userId);
    if (room.participants.length === 0) {
      room.isActive = false;
      endCall(roomId);
    }
  }

  peerConnections.delete(socketId);
  io.to(roomId).emit('user-left-call', { userId, roomId });

  console.log(`User ${userId} left call in room ${roomId}`);
}

async function endCall(roomId: string): Promise<void> {
  const callSession = activeCalls.get(roomId);
  if (callSession) {
    callSession.endTime = new Date();

    await prisma.recording.updateMany({
      where: { callSessionId: callSession.id },
      data: { endTime: callSession.endTime },
    });

    const writeStream = recordingStreams.get(callSession.id);
    if (writeStream) {
      writeStream.end();
      recordingStreams.delete(callSession.id);
    }

    activeCalls.delete(roomId);
  }

  const room = rooms.get(roomId);
  if (room && room.participants.length === 0) {
    rooms.delete(roomId);
  }
}
