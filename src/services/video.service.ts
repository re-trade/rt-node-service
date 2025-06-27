import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../configs/prisma.js';
import { redisClient } from '../configs/redis.js';
import { CallStatus, VideoCallSignal, VideoRoom } from '../types/socket.types.js';

class VideoService {
  private io: SocketIOServer;
  private activeVideoRooms: Map<string, VideoRoom>;
  private userCalls: Map<string, string>;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.activeVideoRooms = new Map();
    this.userCalls = new Map();
  }

  async handleInitiateCall(socket: any, data: { recipientId: string; roomId: string }) {
    const caller = socket.data.user;
    if (!caller) {
      socket.emit('error', { message: 'User not authenticated', code: 'AUTH_ERROR' });
      return;
    }

    const isRecipientOnline = await redisClient.sIsMember('onlineUsers', data.recipientId);
    if (!isRecipientOnline) {
      socket.emit('error', { message: 'Recipient is offline', code: 'USER_OFFLINE' });
      return;
    }

    if (this.userCalls.has(caller.id) || this.userCalls.has(data.recipientId)) {
      socket.emit('error', { message: 'User is already in a call', code: 'CALL_IN_PROGRESS' });
      return;
    }

    const videoRoom: VideoRoom = {
      id: data.roomId,
      participants: [caller],
      startTime: new Date(),
      status: 'active',
    };

    this.activeVideoRooms.set(data.roomId, videoRoom);
    this.userCalls.set(caller.id, data.roomId);

    this.io.to(data.recipientId).emit('incomingCall', {
      callerId: caller.id,
      callerName: caller.username,
      roomId: data.roomId,
    });

    setTimeout(() => {
      if (
        this.activeVideoRooms.has(data.roomId) &&
        this.activeVideoRooms.get(data.roomId)!.participants.length === 1
      ) {
        this.handleCallTimeout(data.roomId, caller.id, data.recipientId);
      }
    }, 30000);
  }

  async handleAcceptCall(socket: any, data: { callerId: string; roomId: string }) {
    const accepter = socket.data.user;
    if (!accepter) return;

    const videoRoom = this.activeVideoRooms.get(data.roomId);
    if (!videoRoom) {
      socket.emit('error', { message: 'Call no longer exists', code: 'CALL_NOT_FOUND' });
      return;
    }

    videoRoom.participants.push(accepter);
    this.userCalls.set(accepter.id, data.roomId);

    this.io.to(data.callerId).emit('callAccepted', {
      accepterId: accepter.id,
      roomId: data.roomId,
    });

    await this.updateCallStatus(data.roomId, {
      isActive: true,
      participants: [data.callerId, accepter.id],
      startTime: new Date(),
      roomId: data.roomId,
    });
  }

  async handleRejectCall(socket: any, data: { callerId: string; reason?: string }) {
    const rejecter = socket.data.user;
    if (!rejecter) return;

    const roomId = this.userCalls.get(data.callerId);
    if (roomId) {
      this.cleanupCall(roomId);

      this.io.to(data.callerId).emit('callRejected', {
        rejecterId: rejecter.id,
        reason: data.reason || 'Call declined',
      });
    }
  }

  async handleEndCall(socket: any, data: { roomId: string }) {
    const user = socket.data.user;
    if (!user) return;

    const videoRoom = this.activeVideoRooms.get(data.roomId);
    if (videoRoom) {
      const duration = new Date().getTime() - videoRoom.startTime.getTime();

      videoRoom.participants.forEach(participant => {
        if (participant.id !== user.id) {
          this.io.to(participant.id).emit('callEnded', {
            enderId: user.id,
            roomId: data.roomId,
            duration,
          });
        }
      });

      await this.cleanupCall(data.roomId);

      await prisma.videoSession.create({
        data: {
          roomId: data.roomId,
          participants: videoRoom.participants.map(p => p.id),
          startTime: videoRoom.startTime,
          endTime: new Date(),
          duration,
          status: 'ended',
        },
      });
    }
  }

  handleSignaling(socket: any, signal: VideoCallSignal) {
    const sender = socket.data.user;
    if (!sender) return;
    this.io.to(signal.to).emit('signaling', {
      ...signal,
      from: sender.id,
    });
  }

  private async cleanupCall(roomId: string) {
    const videoRoom = this.activeVideoRooms.get(roomId);
    if (videoRoom) {
      videoRoom.participants.forEach(participant => {
        this.userCalls.delete(participant.id);
      });
      videoRoom.status = 'ended';
      videoRoom.endTime = new Date();
      this.activeVideoRooms.delete(roomId);
      await redisClient.del(`call:${roomId}`);
    }
  }

  private handleCallTimeout(roomId: string, callerId: string, recipientId: string) {
    this.cleanupCall(roomId);
    this.io.to(callerId).emit('callRejected', {
      rejecterId: recipientId,
      reason: 'No answer',
    });
  }

  private async updateCallStatus(roomId: string, status: CallStatus) {
    await redisClient.set(`call:${roomId}`, JSON.stringify(status), { EX: 24 * 60 * 60 });
  }

  getActiveVideoRoom(roomId: string): VideoRoom | undefined {
    return this.activeVideoRooms.get(roomId);
  }

  isUserInCall(userId: string): boolean {
    return this.userCalls.has(userId);
  }
}

export default VideoService;
