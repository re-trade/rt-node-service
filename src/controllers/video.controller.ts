import { Request, Response } from 'express';
import VideoModel from '../models/VideoModel.js';
import type { ApiResponse, Recording, VideoRoom, VideoSession } from '../types/index.js';

class VideoController {
  static async getRoomStatus(req: Request, res: Response) {
    try {
      const { roomId } = req.params;
      const room = await VideoModel.getVideoRoom(roomId);

      if (!room) {
        return res.status(404).json({
          success: false,
          message: 'Room not found or inactive',
        });
      }

      const response: ApiResponse<{
        roomId: string;
        isActive: boolean;
        participantCount: number;
        maxParticipants: number;
        canJoin: boolean;
      }> = {
        success: true,
        data: {
          roomId: room.id,
          isActive: room.isActive,
          participantCount: room.participants.length,
          maxParticipants: room.maxParticipants,
          canJoin: room.isActive && room.participants.length < room.maxParticipants,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting room status:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching room status',
      });
    }
  }

  static async createRoom(req: Request, res: Response) {
    try {
      const { maxParticipants = 4, name } = req.body;
      const room = await VideoModel.createVideoRoom(maxParticipants);

      const response: ApiResponse<VideoRoom> = {
        success: true,
        message: 'Video room created successfully',
        data: room,
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating video room:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating video room',
      });
    }
  }

  static async getActiveSessions(req: Request, res: Response) {
    try {
      const sessions = await VideoModel.getActiveVideoSessions();
      const response: ApiResponse<VideoSession[]> = {
        success: true,
        data: sessions,
        count: sessions.length,
      };
      res.json(response);
    } catch (error) {
      console.error('Error getting active sessions:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching active sessions',
      });
    }
  }

  static async getAllRecordings(req: Request, res: Response) {
    try {
      const recordings = await VideoModel.getAllRecordings();
      const response: ApiResponse<Recording[]> = {
        success: true,
        data: recordings,
        count: recordings.length,
      };
      res.json(response);
    } catch (error) {
      console.error('Error getting recordings:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching recordings',
      });
    }
  }

  static async getSessionRecordings(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      const recordings = await VideoModel.getRecordingsForSession(sessionId);
      const response: ApiResponse<Recording[]> = {
        success: true,
        data: recordings,
        count: recordings.length,
      };
      res.json(response);
    } catch (error) {
      console.error('Error getting session recordings:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching session recordings',
      });
    }
  }

  static async deleteRecording(req: Request, res: Response) {
    try {
      const { recordingId } = req.params;
      const deleted = await VideoModel.deleteRecording(recordingId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Recording not found or could not be deleted',
        });
      }

      res.json({
        success: true,
        message: 'Recording deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting recording:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting recording',
      });
    }
  }

  static async healthCheck(req: Request, res: Response) {
    try {
      const activeSessions = await VideoModel.getActiveVideoSessions();

      const response: ApiResponse<{ activeSessions: number; timestamp: string }> = {
        success: true,
        message: 'Video service is healthy',
        data: {
          activeSessions: activeSessions.length,
          timestamp: new Date().toISOString(),
        },
      };
      res.json(response);
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({
        success: false,
        message: 'Video service is unhealthy',
      });
    }
  }
}

export default VideoController;
