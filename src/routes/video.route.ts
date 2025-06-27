import { Router } from 'express';
import { Request, Response } from 'express';
import { asyncHandler, validateBody, validateParams, videoSchemas } from '../middleware/index.js';
import { VideoController } from '../controllers/index.js';

const router = Router();

router.get(
  '/health',
  asyncHandler(async (req: Request, res: Response) => {
    await VideoController.healthCheck(req, res);
  })
);

router.post(
  '/rooms',
  validateBody(videoSchemas.createRoom),
  asyncHandler(async (req: Request, res: Response) => {
    await VideoController.createRoom(req, res);
  })
);

router.get(
  '/rooms/:roomId/status',
  validateParams(videoSchemas.roomId),
  asyncHandler(async (req: Request, res: Response) => {
    await VideoController.getRoomStatus(req, res);
  })
);

router.get(
  '/sessions/active',
  asyncHandler(async (req: Request, res: Response) => {
    await VideoController.getActiveSessions(req, res);
  })
);

router.get(
  '/recordings',
  asyncHandler(async (req: Request, res: Response) => {
    await VideoController.getAllRecordings(req, res);
  })
);

router.get(
  '/sessions/:sessionId/recordings',
  validateParams(videoSchemas.sessionId),
  asyncHandler(async (req: Request, res: Response) => {
    await VideoController.getSessionRecordings(req, res);
  })
);

router.delete(
  '/recordings/:recordingId',
  validateParams(videoSchemas.recordingId),
  asyncHandler(async (req: Request, res: Response) => {
    await VideoController.deleteRecording(req, res);
  })
);

export default router;
