export interface Recording {
  id: string;
  callSessionId: string;
  filePath: string;
  startTime: Date;
  endTime?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecordingChunk {
  callSessionId: string;
  chunk: string;
  timestamp: Date;
}

export interface RecordingServerToClientEvents {
  'recording-started': (data: { callSessionId: string; recordingId: string }) => void;
  'recording-stopped': (data: { callSessionId: string; recordingId: string }) => void;
  'recording-error': (error: { message: string; code?: string }) => void;
}

export interface RecordingClientToServerEvents {
  'start-recording': (data: { callSessionId: string }) => void;
  'stop-recording': (data: { callSessionId: string }) => void;
  'recording-chunk': (data: RecordingChunk) => void;
}
