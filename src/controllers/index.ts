import { Request, Response } from 'express';
import ChatController from './chat.controller.js';
import RecordingController from './recording.controller.js';
import VideoController from './video.controller.js';

export { ChatController, RecordingController, VideoController };

export type ControllerFunction = (req: Request, res: Response) => Promise<void>;
export type Handler = (req: Request, res: Response) => void | Promise<void>;

export interface ApiResponse<T = any> {
  success: boolean;
  messages: string[];
  content?: T;
  code: string;
  pagination?: {
    page: number;
    size: number;
    totalPages: number;
    totalElements: number;
  };
}

export default {
  ChatController,
  VideoController,
  RecordingController,
};
