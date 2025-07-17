export interface ModelUser {
  id: string;
  username: string;
  role: string[];
  senderRole: string;
  avatarUrl: string;
}

export interface ModelMessage {
  id: string;
  content: string;
  roomId: string;
  senderId: string;
  createdAt: Date;
  readBy?: string[];
}

export interface ModelRoom {
  id: string;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
  sellerId: string;
  customerId: string;
  messages?: ModelMessage[];
}

export interface ModelVideoSession {
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
