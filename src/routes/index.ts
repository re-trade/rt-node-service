import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { optionalAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import {
  schemas,
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validation.middleware.js';
import {
  createSocketService,
  getOnlineUsers,
  getRooms,
  getRoomMessages,
} from '../services/socket.service.js';
import { createWebRTCService } from '../services/webrtc.service.js';
import { getAllRecordings, deleteRecording } from '../services/recording.service.js';

export const createRoutes = (httpServer: any, corsOrigin: string): Router => {
  const router = Router();
  const socketService = createSocketService(httpServer, corsOrigin);
  const webrtcService = createWebRTCService(socketService.getIO());

  router.get('/health', (req, res) => {
    res.json({
      success: true,
      message: 'Server is healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  router.get(
    '/chat/health',
    asyncHandler(async (req: Request, res: Response) => {
      const users = await getOnlineUsers();
      const rooms = await getRooms();

      res.json({
        success: true,
        message: 'Chat service is healthy',
        data: {
          onlineUsers: users.length,
          activeRooms: rooms.length,
          timestamp: new Date().toISOString(),
        },
      });
    })
  );

  router.get(
    '/chat/users/online',
    optionalAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const users = await getOnlineUsers();
      res.json({
        success: true,
        data: users,
        count: users.length,
      });
    })
  );

  router.get(
    '/chat/rooms',
    optionalAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const rooms = await getRooms();
      res.json({
        success: true,
        data: rooms,
        count: rooms.length,
      });
    })
  );

  router.get(
    '/chat/rooms/:roomId',
    validateParams(schemas.roomId),
    optionalAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { roomId } = req.params;
      const rooms = await getRooms();
      const room = rooms.find(r => r.id === roomId);

      if (!room) {
        res.status(404).json({
          success: false,
          message: 'Room not found',
        });
        return;
      }

      const messages = await getRoomMessages(roomId);

      res.json({
        success: true,
        data: {
          ...room,
          messageCount: messages.length,
          lastMessage: messages[messages.length - 1] || null,
        },
      });
    })
  );

  router.get(
    '/chat/rooms/:roomId/messages',
    validateParams(schemas.roomId),
    validateQuery(schemas.pagination),
    optionalAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { roomId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const allMessages = await getRoomMessages(roomId);
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
    })
  );

  router.get(
    '/webrtc/health',
    asyncHandler(async (req: Request, res: Response) => {
      const activeRooms = webrtcService.getActiveRooms();
      const activeCalls = webrtcService.getActiveCalls();

      res.json({
        success: true,
        message: 'WebRTC service is healthy',
        data: {
          activeRooms: activeRooms.length,
          activeCalls: activeCalls.length,
          timestamp: new Date().toISOString(),
        },
      });
    })
  );

  router.get(
    '/webrtc/rooms/active',
    optionalAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const rooms = webrtcService.getActiveRooms();
      res.json({
        success: true,
        data: rooms,
        count: rooms.length,
      });
    })
  );

  router.get(
    '/webrtc/calls/active',
    optionalAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const calls = webrtcService.getActiveCalls();
      res.json({
        success: true,
        data: calls,
        count: calls.length,
      });
    })
  );

  router.post(
    '/webrtc/rooms',
    validateBody(
      Joi.object({
        maxParticipants: Joi.number().integer().min(2).max(10).default(4),
      })
    ),
    optionalAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { maxParticipants = 4 } = req.body;

      if (maxParticipants < 2 || maxParticipants > 10) {
        res.status(400).json({
          success: false,
          message: 'Max participants must be between 2 and 10',
        });
        return;
      }

      const roomId = webrtcService.createRoom(maxParticipants);

      res.status(201).json({
        success: true,
        message: 'Room created successfully',
        data: {
          roomId,
          maxParticipants,
          createdAt: new Date().toISOString(),
        },
      });
    })
  );

  router.get(
    '/webrtc/rooms/:roomId/status',
    validateParams(schemas.roomId),
    optionalAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { roomId } = req.params;
      const isActive = webrtcService.isRoomActive(roomId);
      const participants = webrtcService.getRoomParticipants(roomId);

      res.json({
        success: true,
        data: {
          roomId,
          isActive,
          participantCount: participants.length,
          canJoin: isActive && participants.length < 4,
        },
      });
    })
  );

  router.get(
    '/webrtc/rooms/:roomId/participants',
    validateParams(schemas.roomId),
    optionalAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { roomId } = req.params;
      const participants = webrtcService.getRoomParticipants(roomId);
      const isActive = webrtcService.isRoomActive(roomId);

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
    })
  );

  router.get(
    '/recordings',
    optionalAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const recordings = await getAllRecordings();
      res.json({
        success: true,
        data: recordings,
        count: recordings.length,
      });
    })
  );

  router.delete(
    '/recordings/:recordingId',
    optionalAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { recordingId } = req.params;
      const deleted = await deleteRecording(recordingId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Recording not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Recording deleted successfully',
      });
    })
  );

  router.get(
    '/webrtc/stats',
    optionalAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const activeRooms = webrtcService.getActiveRooms();
      const activeCalls = webrtcService.getActiveCalls();

      const totalParticipants = activeRooms.reduce(
        (sum, room) => sum + room.participants.length,
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
          roomDetails: activeRooms.map(room => ({
            id: room.id,
            participantCount: room.participants.length,
            maxParticipants: room.maxParticipants,
            createdAt: room.createdAt,
          })),
        },
      });
    })
  );

  router.get('/docs', (req, res) => {
    res.json({
      success: true,
      message: 'RT Node Service API Documentation',
      version: '1.0.0',
      endpoints: {
        health: {
          'GET /api/health': 'Server health check',
        },
        chat: {
          'GET /api/chat/health': 'Chat service health check',
          'GET /api/chat/users/online': 'Get online users',
          'GET /api/chat/rooms': 'Get all chat rooms',
          'GET /api/chat/rooms/:roomId': 'Get room details',
          'GET /api/chat/rooms/:roomId/messages': 'Get room messages with pagination',
        },
        webrtc: {
          'GET /api/webrtc/health': 'WebRTC service health check',
          'GET /api/webrtc/rooms/active': 'Get active WebRTC rooms',
          'GET /api/webrtc/calls/active': 'Get active calls',
          'GET /api/webrtc/stats': 'Get WebRTC statistics',
          'POST /api/webrtc/rooms': 'Create new WebRTC room',
          'GET /api/webrtc/rooms/:roomId/status': 'Check room status',
          'GET /api/webrtc/rooms/:roomId/participants': 'Get room participants',
        },
        recordings: {
          'GET /api/recordings': 'Get all recordings',
          'DELETE /api/recordings/:recordingId': 'Delete a recording',
        },
        websocket: {
          'Socket.IO Chat Events': [
            'authenticate',
            'joinRoom',
            'leaveRoom',
            'createRoom',
            'sendMessage',
            'typing',
          ],
          'Socket.IO WebRTC Events': [
            'join-call',
            'leave-call',
            'signal',
            'start-call',
            'end-call',
            'recording-chunk',
          ],
        },
      },
    });
  });

  return router;
};
