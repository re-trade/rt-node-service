export interface PeerConnection {
  id: string;
  userId: string;
  roomId: string;
  isInitiator: boolean;
  createdAt: Date;
}

export interface SignalData {
  type: 'offer' | 'answer' | 'ice-candidate' | 'signal';
  data: any;
  from?: string;
  to: string;
  roomId: string;
}

export interface WebRTCRoom {
  id: string;
  participants: string[];
  maxParticipants: number;
  isActive: boolean;
  createdAt: Date;
}

export interface CallSession {
  id: string;
  roomId: string;
  participants: string[];
  startTime: Date;
  endTime?: Date;
  type: 'audio' | 'video';
}

export interface WebRTCServerToClientEvents {
  signal: (data: { from: string; type: string; data: any; roomId: string }) => void;
  'user-joined-call': (data: { userId: string; roomId: string }) => void;
  'user-left-call': (data: { userId: string; roomId: string }) => void;
  'call-ended': (data: { roomId: string }) => void;
  'room-full': (data: { roomId: string }) => void;
  'webrtc-error': (error: { message: string; code?: string }) => void;
  'existing-participants': (data: { participants: { socketId: string; userId: string }[] }) => void;
  'new-participant': (data: { socketId: string; userId: string }) => void;
  'recording-started': (data: { callSessionId: string; recordingId: string }) => void;
  'recording-stopped': (data: { callSessionId: string; recordingId: string }) => void;
  'recording-error': (error: { message: string; code?: string }) => void;
}

export interface WebRTCClientToServerEvents {
  'join-call': (data: { roomId: string; userId: string }) => void;
  'leave-call': (data: { roomId: string; userId: string }) => void;
  signal: (data: SignalData) => void;
  'start-call': (data: { roomId: string; type: 'audio' | 'video' }) => void;
  'end-call': (data: { roomId: string }) => void;
  'start-recording': (data: { callSessionId: string }) => void;
  'stop-recording': (data: { callSessionId: string }) => void;
  'recording-chunk': (data: { callSessionId: string; chunk: string; timestamp: Date }) => void;
}
