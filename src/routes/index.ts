import { Router } from 'express';
import { Server as HttpServer } from 'http';
import { createSocketService } from '../services/index.js';
import chatRoutes from './chat.route.js';
import videoRoutes from './video.route.js';

export const createRouter = (httpServer: HttpServer, corsOrigin: string) => {
  const router = Router();

  createSocketService(httpServer, corsOrigin);

  router.get('/health', (req, res) => {
    res.json({
      success: true,
      message: 'Server is healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  router.use('/chat', chatRoutes);
  router.use('/video', videoRoutes);

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
          'POST /api/chat/rooms': 'Create new chat room',
          'POST /api/chat/authenticate': 'Authenticate user',
          'DELETE /api/chat/rooms/:roomId/messages': 'Clear room messages',
        },
        video: {
          'GET /api/video/health': 'Video service health check',
          'GET /api/video/rooms/:roomId/status': 'Get room status',
          'GET /api/video/sessions/active': 'Get active video sessions',
          'GET /api/video/recordings': 'Get all recordings',
          'GET /api/video/sessions/:sessionId/recordings': 'Get session recordings',
          'POST /api/video/rooms': 'Create new video room',
          'DELETE /api/video/recordings/:recordingId': 'Delete recording',
        },
        websocket: {
          chat: [
            'authenticate: Connect and authenticate user',
            'joinRoom: Join a chat room',
            'leaveRoom: Leave a chat room',
            'sendMessage: Send a message',
            'typing: Send typing indicator',
          ],
          video: [
            'initiateCall: Start a video call',
            'acceptCall: Accept incoming call',
            'rejectCall: Reject incoming call',
            'endCall: End ongoing call',
            'signal: WebRTC signaling',
          ],
        },
      },
    });
  });

  return router;
};
