import {
  User,
  Message as ModelMessage,
  Room as ModelRoom,
  VideoSession as ModelVideoSession,
  Recording as ModelRecording,
} from './models.js';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  count?: number;
  error?: string;
  pagination?: {
    limit: number;
    offset: number;
    hasMore?: boolean;
  };
}

export type { User } from './models.js';

export interface OnlineUser extends User {
  isOnline: boolean;
}

export interface Message extends ModelMessage {
  sender?: OnlineUser;
}

export interface Room extends ModelRoom {
  participants: OnlineUser[];
}

export type VideoSession = ModelVideoSession;

export interface VideoRoom {
  id: string;
  participants: OnlineUser[];
  maxParticipants: number;
  isActive: boolean;
  createdAt: Date;
}

export interface VideoCallSignal {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
  from: string | null;
  to: string;
  roomId: string;
}

export type Recording = ModelRecording;

export interface ServerToClientEvents {
  message: (message: Message) => void;
  userJoined: (user: OnlineUser) => void;
  userLeft: (user: OnlineUser) => void;
  roomCreated: (room: Room) => void;
  roomJoined: (room: Room) => void;
  roomLeft: (roomId: string) => void;
  onlineUsers: (users: OnlineUser[]) => void;
  typing: (data: { userId: string; username: string; isTyping: boolean }) => void;
  messageRead: (data: {
    messageId: string;
    userId: string;
    readBy: string[];
    roomId: string;
  }) => void;

  incomingCall: (data: { callerId: string; callerName: string; roomId: string }) => void;
  callAccepted: (data: { accepterId: string; roomId: string }) => void;
  callRejected: (data: { rejecterId: string; reason: string | null }) => void;
  callEnded: (data: { enderId: string; roomId: string; duration: number }) => void;
  signal: (signal: VideoCallSignal) => void;

  error: (error: { message: string; code: string | null }) => void;
}

export interface ClientToServerEvents {
  authenticate: (userData: { username: string; email: string; name: string }) => void;

  sendMessage: (data: { content: string; roomId: string }) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  createRoom: (data: { name: string }) => void;
  typing: (data: { roomId: string; isTyping: boolean }) => void;
  markMessageRead: (data: { messageId: string; roomId: string }) => void;

  initiateCall: (data: { recipientId: string; roomId: string }) => void;
  acceptCall: (data: { callerId: string; roomId: string }) => void;
  rejectCall: (data: { callerId: string; reason?: string }) => void;
  endCall: (data: { roomId: string }) => void;
  signal: (signal: VideoCallSignal) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  user?: OnlineUser;
  rooms: Set<string>;
  activeCall?: VideoSession;
}

export type ValidationError = {
  field: string;
  message: string;
};

export type ValidationResult = {
  isValid: boolean;
  errors?: ValidationError[];
};
