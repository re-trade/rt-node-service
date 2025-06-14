export interface User {
  id: string;
  username: string;
  avatar?: string;
  isOnline: boolean;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  senderUsername: string;
  roomId: string;
  timestamp: Date;
  type: 'text' | 'image' | 'file';
}

export interface Room {
  id: string;
  name: string;
  participants: User[];
  createdAt: Date;
  isPrivate: boolean;
}

export interface ServerToClientEvents {
  message: (message: Message) => void;
  userJoined: (user: User) => void;
  userLeft: (user: User) => void;
  roomCreated: (room: Room) => void;
  roomJoined: (room: Room) => void;
  roomLeft: (roomId: string) => void;
  onlineUsers: (users: User[]) => void;
  typing: (data: { userId: string; username: string; isTyping: boolean }) => void;
  error: (error: { message: string; code?: string }) => void;
}

export interface ClientToServerEvents {
  authenticate: (userData: { username: string; avatar?: string }) => void;
  sendMessage: (data: { content: string; roomId: string }) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  createRoom: (data: { name: string; isPrivate: boolean }) => void;
  typing: (data: { roomId: string; isTyping: boolean }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  user: User;
  rooms: Set<string>;
}
