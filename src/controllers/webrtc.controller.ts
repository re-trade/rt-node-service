import { Request, Response } from 'express';
import { WebRTCService } from '../services/webrtc.service.js';

export class WebRTCController {
  constructor(private webrtcService: WebRTCService) {}

  // Get all active WebRTC rooms
  public getActiveRooms = (req: Request, res: Response): void => {
    try {
      const rooms = this.webrtcService.getActiveRooms();
      res.json({
        success: true,
        data: rooms,
        count: rooms.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get active rooms',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Get all active calls
  public getActiveCalls = (req: Request, res: Response): void => {
    try {
      const calls = this.webrtcService.getActiveCalls();
      res.json({
        success: true,
        data: calls,
        count: calls.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get active calls',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Create a new WebRTC room
  public createRoom = (req: Request, res: Response): void => {
    try {
      const { maxParticipants = 4 } = req.body;

      if (maxParticipants < 2 || maxParticipants > 10) {
        res.status(400).json({
          success: false,
          message: 'Max participants must be between 2 and 10',
        });
        return;
      }

      const roomId = this.webrtcService.createRoom(maxParticipants);

      res.status(201).json({
        success: true,
        message: 'Room created successfully',
        data: {
          roomId,
          maxParticipants,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create room',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Get room participants
  public getRoomParticipants = (req: Request, res: Response): void => {
    try {
      const { roomId } = req.params;

      if (!roomId) {
        res.status(400).json({
          success: false,
          message: 'Room ID is required',
        });
        return;
      }

      const participants = this.webrtcService.getRoomParticipants(roomId);
      const isActive = this.webrtcService.isRoomActive(roomId);

      if (!isActive) {
        res.status(404).json({
          success: false,
          message: 'Room not found or inactive',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          roomId,
          participants,
          participantCount: participants.length,
          isActive,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get room participants',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Check if room exists and is active
  public checkRoomStatus = (req: Request, res: Response): void => {
    try {
      const { roomId } = req.params;

      if (!roomId) {
        res.status(400).json({
          success: false,
          message: 'Room ID is required',
        });
        return;
      }

      const isActive = this.webrtcService.isRoomActive(roomId);
      const participants = this.webrtcService.getRoomParticipants(roomId);

      res.json({
        success: true,
        data: {
          roomId,
          isActive,
          participantCount: participants.length,
          canJoin: isActive && participants.length < 4, // Assuming max 4 participants
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to check room status',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Health check for WebRTC service
  public healthCheck = (req: Request, res: Response): void => {
    try {
      const activeRooms = this.webrtcService.getActiveRooms();
      const activeCalls = this.webrtcService.getActiveCalls();

      res.json({
        success: true,
        message: 'WebRTC service is healthy',
        data: {
          activeRooms: activeRooms.length,
          activeCalls: activeCalls.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'WebRTC service health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Get WebRTC statistics
  public getStats = (req: Request, res: Response): void => {
    try {
      const activeRooms = this.webrtcService.getActiveRooms();
      const activeCalls = this.webrtcService.getActiveCalls();

      const totalParticipants = activeRooms.reduce(
        (sum: number, room: any) => sum + room.participants.length,
        0
      );
      const avgParticipantsPerRoom =
        activeRooms.length > 0 ? totalParticipants / activeRooms.length : 0;

      res.json({
        success: true,
        data: {
          activeRooms: activeRooms.length,
          activeCalls: activeCalls.length,
          totalParticipants,
          avgParticipantsPerRoom: Math.round(avgParticipantsPerRoom * 100) / 100,
          roomDetails: activeRooms.map((room: any) => ({
            id: room.id,
            participantCount: room.participants.length,
            maxParticipants: room.maxParticipants,
            createdAt: room.createdAt,
          })),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get WebRTC statistics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}
