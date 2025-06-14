import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import {
  CallSession,
  PeerConnection,
  SignalData,
  WebRTCClientToServerEvents,
  WebRTCRoom,
  WebRTCServerToClientEvents,
} from '../types/webrtc.types.js';

export class WebRTCService {
  private io: SocketIOServer<WebRTCClientToServerEvents, WebRTCServerToClientEvents>;
  private rooms: Map<string, WebRTCRoom> = new Map();
  private activeCalls: Map<string, CallSession> = new Map();
  private peerConnections: Map<string, PeerConnection> = new Map();

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupWebRTCHandlers();
  }

  private setupWebRTCHandlers(): void {
    this.io.on('connection', socket => {
      console.log(`WebRTC client connected: ${socket.id}`);
      socket.on('join-call', (data: { roomId: string; userId: string }) => {
        const { roomId, userId } = data;

        let room = this.rooms.get(roomId);
        if (!room) {
          room = {
            id: roomId,
            participants: [],
            maxParticipants: 4,
            isActive: true,
            createdAt: new Date(),
          };
          this.rooms.set(roomId, room);
        }
        if (room.participants.length >= room.maxParticipants) {
          socket.emit('room-full', { roomId });
          return;
        }
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
        this.peerConnections.set(socket.id, peerConnection);
        socket.to(roomId).emit('user-joined-call', { userId, roomId });
        console.log(`User ${userId} joined call in room ${roomId}`);
      });
      socket.on('leave-call', (data: { roomId: string; userId: string }) => {
        const { roomId, userId } = data;

        this.handleUserLeaveCall(socket.id, roomId, userId);
      });
      socket.on('signal', (data: SignalData) => {
        const { to, roomId } = data;
        socket.to(roomId).emit('signal', {
          ...data,
          from: socket.id,
        });

        console.log(`Signal forwarded from ${socket.id} to room ${roomId}`);
      });
      socket.on('start-call', (data: { roomId: string; type: 'audio' | 'video' }) => {
        const { roomId, type } = data;
        const peerConnection = this.peerConnections.get(socket.id);

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
        this.activeCalls.set(roomId, callSession);

        console.log(`Call started in room ${roomId} by ${peerConnection.userId}`);
      });
      socket.on('end-call', (data: { roomId: string }) => {
        const { roomId } = data;

        this.endCall(roomId);
        socket.to(roomId).emit('call-ended', { roomId });

        console.log(`Call ended in room ${roomId}`);
      });
      socket.on('disconnect', () => {
        console.log(`WebRTC client disconnected: ${socket.id}`);

        const peerConnection = this.peerConnections.get(socket.id);
        if (peerConnection) {
          this.handleUserLeaveCall(socket.id, peerConnection.roomId, peerConnection.userId);
        }
      });
    });
  }

  private handleUserLeaveCall(socketId: string, roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.participants = room.participants.filter((id: any) => id !== userId);
      if (room.participants.length === 0) {
        room.isActive = false;
        this.endCall(roomId);
      }
    }
    this.peerConnections.delete(socketId);
    this.io.to(roomId).emit('user-left-call', { userId, roomId });

    console.log(`User ${userId} left call in room ${roomId}`);
  }

  private endCall(roomId: string): void {
    const callSession = this.activeCalls.get(roomId);
    if (callSession) {
      callSession.endTime = new Date();
      this.activeCalls.delete(roomId);
    }
    const room = this.rooms.get(roomId);
    if (room && room.participants.length === 0) {
      this.rooms.delete(roomId);
    }
  }
  public getActiveRooms(): WebRTCRoom[] {
    return Array.from(this.rooms.values()).filter(room => room.isActive);
  }

  public getActiveCalls(): CallSession[] {
    return Array.from(this.activeCalls.values());
  }

  public getRoomParticipants(roomId: string): string[] {
    const room = this.rooms.get(roomId);
    return room ? room.participants : [];
  }

  public isRoomActive(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    return room ? room.isActive : false;
  }

  public createRoom(maxParticipants: number = 4): string {
    const roomId = uuidv4();
    const room: WebRTCRoom = {
      id: roomId,
      participants: [],
      maxParticipants,
      isActive: true,
      createdAt: new Date(),
    };

    this.rooms.set(roomId, room);
    return roomId;
  }
}
