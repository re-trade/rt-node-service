import { Request, Response } from 'express';
import ChatModel from '../models/ChatModel.js';
import type { ApiResponse, Message, OnlineUser, Room } from '../types/index.js';

class ChatController {
  static async getOnlineUsers(req: Request, res: Response) {
    try {
      const users = await ChatModel.getOnlineUsers();
      const response: ApiResponse<OnlineUser[]> = {
        success: true,
        data: users,
        count: users.length,
      };
      res.json(response);
    } catch (error) {
      console.error('Error getting online users:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching online users',
      });
    }
  }

  static async getRooms(req: Request, res: Response) {
    try {
      const rooms = await ChatModel.getRooms();
      const response: ApiResponse<Room[]> = {
        success: true,
        data: rooms,
        count: rooms.length,
      };
      res.json(response);
    } catch (error) {
      console.error('Error getting rooms:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching rooms',
      });
    }
  }

  static async getRoomById(req: Request, res: Response) {
    try {
      const { roomId } = req.params;
      const room = await ChatModel.getRoomById(roomId);

      if (!room) {
        return res.status(404).json({
          success: false,
          message: 'Room not found',
        });
      }

      const messages = await ChatModel.getRoomMessages(roomId);
      const response: ApiResponse<Room & { messageCount: number; lastMessage: Message | null }> = {
        success: true,
        data: {
          ...room,
          messageCount: messages.length,
          lastMessage: messages[messages.length - 1] || null,
        },
      };
      res.json(response);
    } catch (error) {
      console.error('Error getting room:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching room',
      });
    }
  }

  static async getRoomMessages(req: Request, res: Response) {
    try {
      const { roomId } = req.params;
      const { limit = '50', offset = '0' } = req.query;

      const messages = await ChatModel.getRoomMessages(roomId, Number(limit), Number(offset));

      const response: ApiResponse<Message[]> = {
        success: true,
        data: messages,
        count: messages.length,
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
        },
      };
      res.json(response);
    } catch (error) {
      console.error('Error getting messages:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching messages',
      });
    }
  }

  static async createRoom(req: Request, res: Response) {
    try {
      const { name } = req.body;
      const room = await ChatModel.createRoom(name);

      const response: ApiResponse<Room> = {
        success: true,
        data: room,
        message: 'Room created successfully',
      };
      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating room:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating room',
      });
    }
  }

  static async authenticateUser(req: Request, res: Response) {
    try {
      const { username, email, name } = req.body;
      const user = await ChatModel.createUser({ username, email, name });

      const response: ApiResponse<OnlineUser> = {
        success: true,
        data: user,
        message: 'User authenticated successfully',
      };
      res.status(200).json(response);
    } catch (error) {
      console.error('Error authenticating user:', error);
      res.status(500).json({
        success: false,
        message: 'Error authenticating user',
      });
    }
  }

  static async healthCheck(req: Request, res: Response) {
    try {
      const users = await ChatModel.getOnlineUsers();
      const rooms = await ChatModel.getRooms();

      const response: ApiResponse<{ onlineUsers: number; activeRooms: number; timestamp: string }> =
        {
          success: true,
          message: 'Chat service is healthy',
          data: {
            onlineUsers: users.length,
            activeRooms: rooms.length,
            timestamp: new Date().toISOString(),
          },
        };
      res.json(response);
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({
        success: false,
        message: 'Chat service is unhealthy',
      });
    }
  }

  static async clearRoomMessages(req: Request, res: Response) {
    try {
      const { roomId } = req.params;
      await ChatModel.clearRoomMessages(roomId);

      res.json({
        success: true,
        message: 'Room messages cleared successfully',
      });
    } catch (error) {
      console.error('Error clearing messages:', error);
      res.status(500).json({
        success: false,
        message: 'Error clearing room messages',
      });
    }
  }
}

export default ChatController;
