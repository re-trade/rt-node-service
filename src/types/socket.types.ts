export interface VideoCallSignal {
  type: 'offer' | 'answer' | 'ice-candidate';
  payload: any;
  from: string;
  to: string;
}