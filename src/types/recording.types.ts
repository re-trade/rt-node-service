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
