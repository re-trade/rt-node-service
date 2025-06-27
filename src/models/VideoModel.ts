import { prisma } from '../configs/prisma.js';
import { redisClient } from '../configs/redis.js';
import type { VideoSession, VideoRoom, Recording } from '../types/index.js';

class VideoModel {
  async createVideoRoom(maxParticipants: number = 4): Promise<VideoRoom> {
    const room = await prisma.room.create({
      data: {
        name: `Video Room ${Date.now()}`,
        isPrivate: true,
      },
    });

    const videoRoom: VideoRoom = {
      id: room.id,
      participants: [],
      maxParticipants,
      isActive: true,
      createdAt: new Date(),
    };

    await redisClient.set(`videoroom:${room.id}`, JSON.stringify(videoRoom));
    return videoRoom;
  }

  async getVideoRoom(roomId: string): Promise<VideoRoom | null> {
    const cached = await redisClient.get(`videoroom:${roomId}`);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  }

  async addParticipantToRoom(roomId: string, userId: string): Promise<boolean> {
    const room = await this.getVideoRoom(roomId);
    if (!room || room.participants.length >= room.maxParticipants) {
      return false;
    }

    room.participants.push(userId);
    await redisClient.set(`videoroom:${roomId}`, JSON.stringify(room));
    return true;
  }

  async removeParticipantFromRoom(roomId: string, userId: string): Promise<void> {
    const room = await this.getVideoRoom(roomId);
    if (room) {
      room.participants = room.participants.filter(id => id !== userId);
      if (room.participants.length === 0) {
        room.isActive = false;
      }
      await redisClient.set(`videoroom:${roomId}`, JSON.stringify(room));
    }
  }

  async createVideoSession(roomId: string, participants: string[]): Promise<VideoSession> {
    const session = await prisma.videoSession.create({
      data: {
        roomId,
        startTime: new Date(),
        participants,
        status: 'active',
        endTime: null,
        recordingUrl: null,
        duration: null,
      },
    });

    await redisClient.set(`videosession:${session.id}`, JSON.stringify(session));
    return session;
  }

  async endVideoSession(sessionId: string, duration?: number): Promise<VideoSession> {
    const session = await prisma.videoSession.update({
      where: { id: sessionId },
      data: {
        endTime: new Date(),
        status: 'ended',
        duration: duration || null,
      },
    });

    await redisClient.del(`videosession:${sessionId}`);
    return session;
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

  async getActiveVideoSessions(): Promise<VideoSession[]> {
    return await prisma.videoSession.findMany({
      where: { status: 'active' },
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
