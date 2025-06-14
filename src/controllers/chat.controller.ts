import { Request, Response } from 'express';
import { SocketService } from '../services/socket.service.js';

export class ChatController {
  constructor(private socketService: SocketService) {}

  // Get all online users
  public getOnlineUsers = (req: Request, res: Response): void => {
    try {
      const users = this.socketService.getOnlineUsers();
      res.json({
        success: true,
        data: users,
        count: users.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get online users',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Get all available rooms
  public getRooms = (req: Request, res: Response): void => {
    try {
      const rooms = this.socketService.getRooms();
      res.json({
        success: true,
        data: rooms,
        count: rooms.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get rooms',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Get messages for a specific room
  public getRoomMessages = (req: Request, res: Response): void => {
    try {
      const { roomId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      if (!roomId) {
        res.status(400).json({
          success: false,
          message: 'Room ID is required',
        });
        return;
      }

      const allMessages = this.socketService.getRoomMessages(roomId);
      const startIndex = Math.max(0, allMessages.length - Number(limit) - Number(offset));
      const endIndex = allMessages.length - Number(offset);
      const messages = allMessages.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: messages,
        count: messages.length,
        total: allMessages.length,
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          hasMore: startIndex > 0,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get room messages',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Get room details
  public getRoomDetails = (req: Request, res: Response): void => {
    try {
      const { roomId } = req.params;

      if (!roomId) {
        res.status(400).json({
          success: false,
          message: 'Room ID is required',
        });
        return;
      }

      const rooms = this.socketService.getRooms();
      const room = rooms.find((r: any) => r.id === roomId);

      if (!room) {
        res.status(404).json({
          success: false,
          message: 'Room not found',
        });
        return;
      }

      const messages = this.socketService.getRoomMessages(roomId);

      res.json({
        success: true,
        data: {
          ...room,
          messageCount: messages.length,
          lastMessage: messages[messages.length - 1] || null,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get room details',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Health check for chat service
  public healthCheck = (req: Request, res: Response): void => {
    try {
      const users = this.socketService.getOnlineUsers();
      const rooms = this.socketService.getRooms();

      res.json({
        success: true,
        message: 'Chat service is healthy',
        data: {
          onlineUsers: users.length,
          activeRooms: rooms.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Chat service health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}
