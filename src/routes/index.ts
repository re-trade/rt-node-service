import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller.js';
import { WebRTCController } from '../controllers/webrtc.controller.js';
import { SocketService } from '../services/socket.service.js';
import { WebRTCService } from '../services/webrtc.service.js';
import {
  validateParams,
  validateQuery,
  validateBody,
  schemas,
} from '../middleware/validation.middleware.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';

export const createRoutes = (
  socketService: SocketService,
  webrtcService: WebRTCService
): Router => {
  const router = Router();
  const chatController = new ChatController(socketService);
  const webrtcController = new WebRTCController(webrtcService);

  router.get('/health', (req, res) => {
    res.json({
      success: true,
      message: 'Server is healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  router.get('/chat/health', asyncHandler(chatController.healthCheck));
  router.get('/chat/users/online', optionalAuth, asyncHandler(chatController.getOnlineUsers));
  router.get('/chat/rooms', optionalAuth, asyncHandler(chatController.getRooms));
  router.get(
    '/chat/rooms/:roomId',
    validateParams(schemas.roomId),
    optionalAuth,
    asyncHandler(chatController.getRoomDetails)
  );
  router.get(
    '/chat/rooms/:roomId/messages',
    validateParams(schemas.roomId),
    validateQuery(schemas.pagination),
    optionalAuth,
    asyncHandler(chatController.getRoomMessages)
  );

  router.get('/webrtc/health', asyncHandler(webrtcController.healthCheck));
  router.get('/webrtc/rooms/active', optionalAuth, asyncHandler(webrtcController.getActiveRooms));
  router.get('/webrtc/calls/active', optionalAuth, asyncHandler(webrtcController.getActiveCalls));
  router.get('/webrtc/stats', optionalAuth, asyncHandler(webrtcController.getStats));

  router.post(
    '/webrtc/rooms',
    validateBody(
      Joi.object({
        maxParticipants: Joi.number().integer().min(2).max(10).default(4),
      })
    ),
    optionalAuth,
    asyncHandler(webrtcController.createRoom)
  );

  router.get(
    '/webrtc/rooms/:roomId/status',
    validateParams(schemas.roomId),
    optionalAuth,
    asyncHandler(webrtcController.checkRoomStatus)
  );

  router.get(
    '/webrtc/rooms/:roomId/participants',
    validateParams(schemas.roomId),
    optionalAuth,
    asyncHandler(webrtcController.getRoomParticipants)
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
          ],
        },
      },
    });
  });

  return router;
};

// Import Joi for inline validation
import Joi from 'joi';
