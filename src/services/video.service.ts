import { Server as SocketIOServer } from 'socket.io';
import { redisClient } from '../configs/redis.js';
import { VideoCallSignal } from '../types/socket.types.js';
import { createWebRTCService } from './webrtc.service.js';

class VideoService {
  private io: SocketIOServer;
  private webRTCService: ReturnType<typeof createWebRTCService>;
  private userToRoomMap: Map<string, string>;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.webRTCService = createWebRTCService(io);
    this.userToRoomMap = new Map();
  }

  async handleInitiateCall(socket: any, data: { recipientId: string; roomId: string }) {
    const caller = socket.data.user;
    if (!caller) {
      socket.emit('error', { message: 'User not authenticated', code: 'AUTH_ERROR' });
      return;
    }
    console.log('handleInitiateCall', caller.id, data.recipientId, data.roomId);

    const isRecipientOnline = await redisClient.sIsMember('onlineUsers', data.recipientId);
    if (!isRecipientOnline) {
      socket.emit('error', { message: 'Recipient is offline', code: 'USER_OFFLINE' });
      return;
    }

    if (
      this.webRTCService
        .getRoomParticipants(data.roomId)
        .some(id => id === caller.id || id === data.recipientId)
    ) {
      socket.emit('error', { message: 'User is already in a call', code: 'CALL_IN_PROGRESS' });
      return;
    }

    if (!this.webRTCService.isRoomActive(data.roomId)) {
      data.roomId = this.webRTCService.createRoom(2); // 2 participants for 1-1 calls
    }

    this.userToRoomMap.set(caller.id, data.roomId);
    socket.emit('join-call', { roomId: data.roomId, userId: caller.id });
    this.io.to(data.recipientId).emit('incomingCall', {
      callerId: caller.id,
      callerName: caller.username,
      roomId: data.roomId,
    });

    setTimeout(() => {
      const participants = this.webRTCService.getRoomParticipants(data.roomId);
      if (participants.length === 1 && participants[0] === caller.id) {
        this.handleCallTimeout(data.roomId, caller.id, data.recipientId);
      }
    }, 30000);
  }

  async handleAcceptCall(socket: any, data: { callerId: string; roomId: string }) {
    const accepter = socket.data.user;
    if (!accepter) return;

    if (!this.webRTCService.isRoomActive(data.roomId)) {
      socket.emit('error', { message: 'Call no longer exists', code: 'CALL_NOT_FOUND' });
      return;
    }

    socket.emit('join-call', { roomId: data.roomId, userId: accepter.id });
    this.io.to(data.callerId).emit('callAccepted', {
      accepterId: accepter.id,
      roomId: data.roomId,
    });
  }

  async handleRejectCall(socket: any, data: { callerId: string; roomId: string; reason?: string }) {
    const rejecter = socket.data.user;
    if (!rejecter) return;

    if (this.webRTCService.isRoomActive(data.roomId)) {
      socket.emit('end-call', { roomId: data.roomId });
      this.io.to(data.callerId).emit('callRejected', {
        rejecterId: rejecter.id,
        reason: data.reason || 'Call declined',
      });
    }
  }

  async handleEndCall(socket: any, data: { roomId: string }) {
    const user = socket.data.user;
    if (!user) return;

    socket.emit('end-call', { roomId: data.roomId });
    this.io.to(data.roomId).emit('call-ended', { roomId: data.roomId });
  }

  handleSignaling(socket: any, signal: VideoCallSignal) {
    const sender = socket.data.user;
    if (!sender) return;
    this.io.to(signal.to).emit('signal', {
      ...signal,
      from: sender.id,
    });
  }

  private handleCallTimeout(roomId: string, callerId: string, recipientId: string) {
    this.io.to(callerId).emit('callRejected', {
      rejecterId: recipientId,
      reason: 'No answer',
    });
    this.io.emit('end-call', { roomId });
  }

  isUserInCall(userId: string): boolean {
    return this.webRTCService.getActiveRooms().some(room => room.participants.includes(userId));
  }

  getRoomIdForUser(userId: string): string | undefined {
    return this.userToRoomMap.get(userId);
  }
}

export default VideoService;
