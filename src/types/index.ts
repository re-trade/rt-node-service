import {
  Message as ModelMessage,
  Room as ModelRoom,
  User,
  VideoSession as ModelVideoSession,
} from './models.js';

export type { WebRTCClientToServerEvents, WebRTCServerToClientEvents } from './webrtc.types.js';

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

export interface ServerToClientEvents {
  message: (message: Message) => void;
  rooms: (rooms: Room[]) => void;
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

  signal: (data: {
    from: string;
    type: 'signal' | 'offer' | 'answer' | 'ice-candidate';
    data: any;
    roomId: string;
  }) => void;

  incomingCall: (data: { callerId: string; callerName: string; roomId: string }) => void;
  callAccepted: (data: { acceptedId: string; roomId: string }) => void;
  callRejected: (data: { rejecterId: string; reason: string | null }) => void;
  callEnded: (data: { enderId: string; roomId: string; duration: number }) => void;

  error: (error: { message: string; code: string | null }) => void;
}

export interface ClientToServerEvents {
  authenticate: (userData: { token?: string; senderType: 'customer' | 'seller' }) => void;
  getUserRooms: () => void;
  sendMessage: (data: { content: string; roomId: string }) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  createRoom: (data: { name: string }) => void;

  typing: (data: { roomId: string; isTyping: boolean }) => void;
  markMessageRead: (data: { messageId: string; roomId: string }) => void;

  signal: (data: {
    to: string;
    type: 'offer' | 'answer' | 'ice-candidate';
    data: any;
    roomId: string;
  }) => void;

  initiateCall: (data: { recipientId: string; roomId: string }) => void;
  acceptCall: (data: { callerId: string; roomId: string }) => void;
  rejectCall: (data: { callerId: string; reason?: string }) => void;
  endCall: (data: { roomId: string }) => void;
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
