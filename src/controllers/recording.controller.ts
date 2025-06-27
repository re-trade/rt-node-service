import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../configs/prisma.js';
import type { ApiResponse, Recording } from '../types/index.js';

const RECORDINGS_DIR = path.join(process.cwd(), 'recordings');

class RecordingController {
  static async initRecordingsDir() {
    if (!fs.existsSync(RECORDINGS_DIR)) {
      fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
    }
  }
  static async getAllRecordings(req: Request, res: Response) {
    try {
      const recordings = await prisma.recording.findMany({
        orderBy: { createdAt: 'desc' },
      });

      const response: ApiResponse<Recording[]> = {
        success: true,
        data: recordings,
        count: recordings.length,
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting recordings:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching recordings',
      });
    }
  }

  static async getRecordingById(req: Request, res: Response) {
    try {
      const { recordingId } = req.params;
      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
      });

      if (!recording) {
        return res.status(404).json({
          success: false,
          message: 'Recording not found',
        });
      }

      res.json({
        success: true,
        data: recording,
      });
    } catch (error) {
      console.error('Error getting recording:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching recording',
      });
    }
  }

  static async createRecording(req: Request, res: Response) {
    try {
      const { callSessionId } = req.body;
      const filePath = path.join(RECORDINGS_DIR, `${callSessionId}.webm`);

      const recording = await prisma.recording.create({
        data: {
          callSessionId,
          filePath,
          startTime: new Date(),
        },
      });

      res.status(201).json({
        success: true,
        data: recording,
        message: 'Recording started successfully',
      });
    } catch (error) {
      console.error('Error creating recording:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating recording',
      });
    }
  }

  static async deleteRecording(req: Request, res: Response) {
    try {
      const { recordingId } = req.params;
      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
      });

      if (!recording) {
        return res.status(404).json({
          success: false,
          message: 'Recording not found',
        });
      }

      if (fs.existsSync(recording.filePath)) {
        fs.unlinkSync(recording.filePath);
      }

      await prisma.recording.delete({
        where: { id: recordingId },
      });

      res.json({
        success: true,
        message: 'Recording deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting recording:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting recording',
      });
    }
  }

  static async handleRecordingChunk(req: Request, res: Response) {
    try {
      const { recordingId } = req.params;
      const chunk = req.body;

      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
      });

      if (!recording) {
        return res.status(404).json({
          success: false,
          message: 'Recording not found',
        });
      }

      fs.appendFileSync(recording.filePath, Buffer.from(chunk));

      res.json({
        success: true,
        message: 'Chunk saved successfully',
      });
    } catch (error) {
      console.error('Error handling recording chunk:', error);
      res.status(500).json({
        success: false,
        message: 'Error saving recording chunk',
      });
    }
  }

  // Stop recording
  static async stopRecording(req: Request, res: Response) {
    try {
      const { recordingId } = req.params;
      const recording = await prisma.recording.update({
        where: { id: recordingId },
        data: { endTime: new Date() },
      });

      res.json({
        success: true,
        data: recording,
        message: 'Recording stopped successfully',
      });
    } catch (error) {
      console.error('Error stopping recording:', error);
      res.status(500).json({
        success: false,
        message: 'Error stopping recording',
      });
    }
  }

  static async getRecordingFile(req: Request, res: Response) {
    try {
      const { recordingId } = req.params;
      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
      });

      if (!recording) {
        return res.status(404).json({
          success: false,
          message: 'Recording not found',
        });
      }

      if (!fs.existsSync(recording.filePath)) {
        return res.status(404).json({
          success: false,
          message: 'Recording file not found',
        });
      }

      res.sendFile(recording.filePath);
    } catch (error) {
      console.error('Error getting recording file:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching recording file',
      });
    }
  }
}

export default RecordingController;
