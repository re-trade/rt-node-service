import fs from 'fs';
import path from 'path';
import { prisma } from '../configs/prisma.js';
import { Recording } from '../types/recording.types.js';

const RECORDINGS_DIR = path.join(process.cwd(), 'recordings');

export async function initializeRecordingsDirectory(): Promise<void> {
  if (!fs.existsSync(RECORDINGS_DIR)) {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
  }
}

export async function createRecording(callSessionId: string): Promise<Recording> {
  await initializeRecordingsDirectory();

  const filePath = path.join(RECORDINGS_DIR, `${callSessionId}.webm`);

  return prisma.recording.create({
    data: {
      callSessionId,
      filePath,
      startTime: new Date(),
    },
  });
}

export async function stopRecording(callSessionId: string): Promise<Recording | null> {
  const recording = await prisma.recording.findFirst({
    where: { callSessionId },
  });

  if (!recording) {
    return null;
  }

  return prisma.recording.update({
    where: { id: recording.id },
    data: { endTime: new Date() },
  });
}

export async function getRecordingsByCallSession(callSessionId: string): Promise<Recording[]> {
  return prisma.recording.findMany({
    where: { callSessionId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAllRecordings(): Promise<Recording[]> {
  return prisma.recording.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function deleteRecording(recordingId: string): Promise<boolean> {
  try {
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
    });

    if (!recording) {
      return false;
    }

    if (fs.existsSync(recording.filePath)) {
      fs.unlinkSync(recording.filePath);
    }

    await prisma.recording.delete({
      where: { id: recordingId },
    });

    return true;
  } catch (error) {
    console.error('Error deleting recording:', error);
    return false;
  }
}

export function createWriteStream(callSessionId: string): fs.WriteStream {
  const filePath = path.join(RECORDINGS_DIR, `${callSessionId}.webm`);
  return fs.createWriteStream(filePath);
}
