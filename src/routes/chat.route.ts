import { Router } from 'express';
import { Request, Response } from 'express';
import {
  asyncHandler,
  validateBody,
  validateParams,
  validateQuery,
  chatSchemas,
} from '../middleware/index.js';
import { ChatController } from '../controllers/index.js';

const router = Router();

// Health check
router.get(
  '/health',
  asyncHandler(async (req: Request, res: Response) => {
    await ChatController.healthCheck(req, res);
  })
);

// Get online users
router.get(
  '/users/online',
  asyncHandler(async (req: Request, res: Response) => {
    await ChatController.getOnlineUsers(req, res);
  })
);

// Get all rooms
router.get(
  '/rooms',
  asyncHandler(async (req: Request, res: Response) => {
    await ChatController.getRooms(req, res);
  })
);

// Get room by ID with messages
router.get(
  '/rooms/:roomId',
  validateParams(chatSchemas.roomId),
  asyncHandler(async (req: Request, res: Response) => {
    await ChatController.getRoomById(req, res);
  })
);

// Get room messages with pagination
router.get(
  '/rooms/:roomId/messages',
  validateParams(chatSchemas.roomId),
  validateQuery(chatSchemas.pagination),
  asyncHandler(async (req: Request, res: Response) => {
    await ChatController.getRoomMessages(req, res);
  })
);

// Create new room
router.post(
  '/rooms',
  validateBody(chatSchemas.createRoom),
  asyncHandler(async (req: Request, res: Response) => {
    await ChatController.createRoom(req, res);
  })
);

// User authentication
router.post(
  '/authenticate',
  validateBody(chatSchemas.authenticate),
  asyncHandler(async (req: Request, res: Response) => {
    await ChatController.authenticateUser(req, res);
  })
);

// Clear room messages
router.delete(
  '/rooms/:roomId/messages',
  validateParams(chatSchemas.roomId),
  asyncHandler(async (req: Request, res: Response) => {
    await ChatController.clearRoomMessages(req, res);
  })
);

export default router;
