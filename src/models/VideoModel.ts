import { prisma } from '../configs/prisma.js';
import { redisClient } from '../configs/redis.js';
import type { VideoSession, VideoRoom, OnlineUser, Recording } from '../types/index.js';

class VideoModel {
  async createVideoRoom(maxParticipants: number = 4): Promise<VideoRoom> {
    const room: VideoRoom = {
      id: crypto.randomUUID(),
      participants: [],
      maxParticipants,
      isActive: true,
      createdAt: new Date(),
    };

    await redisClient.set(`videoRoom:${room.id}`, JSON.stringify(room));
    return room;
  }

  async getVideoRoom(roomId: string): Promise<VideoRoom | null> {
    const roomData = await redisClient.get(`videoRoom:${roomId}`);
    if (!roomData) return null;

    const room = JSON.parse(roomData) as VideoRoom;
    if (!room.isActive) {
      await redisClient.del(`videoRoom:${roomId}`);
      return null;
    }

    return room;
  }

  async addParticipant(roomId: string, userId: string): Promise<boolean> {
    const room = await this.getVideoRoom(roomId);
    if (!room || room.participants.length >= room.maxParticipants) {
      return false;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;

    const onlineUser = { ...user, isOnline: true } as OnlineUser;
    room.participants.push(onlineUser);
    await redisClient.set(`videoRoom:${roomId}`, JSON.stringify(room));
    return true;
  }

  async removeParticipant(roomId: string, userId: string): Promise<void> {
    const room = await this.getVideoRoom(roomId);
    if (!room) return;

    room.participants = room.participants.filter((participant: OnlineUser) => participant.id !== userId);
    if (room.participants.length === 0) {
      await redisClient.del(`videoRoom:${roomId}`);
    } else {
      await redisClient.set(`videoRoom:${roomId}`, JSON.stringify(room));
    }
  }

  async createVideoSession(data: { roomId: string }): Promise<VideoSession> {
    const session = await prisma.videoSession.create({
      data: {
        ...data,
        startTime: new Date(),
        status: 'active',
        participants: [],
      },
    });

    const { recordingUrl: rawUrl, ...rest } = session;
    return {
      ...rest,
      recordingUrl: rawUrl ?? undefined,
      duration: undefined
    };
  }

  async endVideoSession(sessionId: string, duration?: number): Promise<VideoSession> {
    const session = await prisma.videoSession.update({
      where: { id: sessionId },
      data: {
        endTime: new Date(),
        status: 'ended',
        duration: duration ?? undefined
      },
    });

    const { recordingUrl: rawUrl, ...rest } = session;
    return {
      ...rest,
      recordingUrl: rawUrl ?? undefined,
      duration: rest.duration ?? undefined
    };
  }

  async getActiveVideoSessions(): Promise<VideoSession[]> {
    const sessions = await prisma.videoSession.findMany({
      where: { status: 'active' },
    });

    return sessions.map(session => {
      const { recordingUrl: rawUrl, ...rest } = session;
      return {
        ...rest,
        recordingUrl: rawUrl ?? undefined,
        duration: rest.duration ?? undefined
      };
    });
  }

  async createRecording(data: { callSessionId: string; filePath: string }): Promise<Recording> {
    return await prisma.recording.create({
      data: {
        ...data,
        startTime: new Date(),
        endTime: null,
      },
    });
  }

  async endRecording(recordingId: string): Promise<Recording | null> {
    return await prisma.recording.update({
      where: { id: recordingId },
      data: { endTime: new Date() },
    });
  }

  async getRecordingsForSession(sessionId: string): Promise<Recording[]> {
    return await prisma.recording.findMany({
      where: { callSessionId: sessionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllRecordings(): Promise<Recording[]> {
    return await prisma.recording.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteRecording(recordingId: string): Promise<boolean> {
    try {
      const recording = await prisma.recording.delete({
        where: { id: recordingId },
      });
      return !!recording;
    } catch (error) {
      console.error('Error deleting recording:', error);
      return false;
    }
  }
}

export default new VideoModel();
