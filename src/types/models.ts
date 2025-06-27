export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  content: string;
  roomId: string;
  senderId: string;
  createdAt: Date;
  readBy?: string[];
}

export interface Room {
  id: string;
  name: string;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
  messages?: Message[];
}

export interface VideoSession {
  id: string;
  roomId: string;
  startTime: Date;
  endTime: Date | null;
  participants: string[];
  recordingUrl?: string;
  duration?: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Recording {
  id: string;
  callSessionId: string;
  filePath: string;
  startTime: Date;
  endTime: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
