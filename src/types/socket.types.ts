import { Message, Room, User } from './models.js';

export interface OnlineUser extends User {
  isOnline: boolean;
  avatar?: string;
}

export interface VideoCallSignal {
  type: 'offer' | 'answer' | 'ice-candidate';
  payload: any;
  from: string;
  to: string;
}

export interface CallStatus {
  isActive: boolean;
  participants: string[];
  startTime?: Date;
  roomId: string;
}

export interface VideoRoom {
  id: string;
  participants: OnlineUser[];
  startTime: Date;
  status: 'active' | 'ended';
  endTime?: Date;
}

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

  // Video call events
  incomingCall: (data: { callerId: string; callerName: string; roomId: string }) => void;
  callAccepted: (data: { accepterId: string; roomId: string }) => void;
  callRejected: (data: { rejecterId: string; reason?: string }) => void;
  callEnded: (data: { enderId: string; roomId: string; duration: number }) => void;
  signaling: (signal: VideoCallSignal) => void;

  // System events
  error: (error: { message: string; code?: string }) => void;
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
  activeCall?: CallStatus;
}
