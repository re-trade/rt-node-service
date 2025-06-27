import { Request, Response } from 'express';
import ChatController from './chat.controller.js';
import VideoController from './video.controller.js';
import RecordingController from './recording.controller.js';

// Re-export all controllers
export { ChatController, VideoController, RecordingController };

// Common controller types
export type ControllerFunction = (req: Request, res: Response) => Promise<void>;
export type Handler = (req: Request, res: Response) => void | Promise<void>;

// Interface for standardized API responses
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  count?: number;
  error?: string;
  pagination?: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Default export for convenience
export default {
  ChatController,
  VideoController,
  RecordingController,
};
