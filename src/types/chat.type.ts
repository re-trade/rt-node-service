import { ModelMessage, ModelRoom, ModelUser, ModelVideoSession } from './models.js';

export interface ChattingUser extends ModelUser {
  isOnline: boolean;
  name: string;
}

export interface Message extends ModelMessage {
  sender?: ChattingUser;
}

export interface Room extends ModelRoom {
  participants: ChattingUser[];
}

export type VideoSession = ModelVideoSession;
