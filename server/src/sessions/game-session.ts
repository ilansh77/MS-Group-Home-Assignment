export enum GameSessionStatus {
  Active = 'active',
  CashedOut = 'cashed-out',
}

export interface GameSession {
  id: string;
  credits: number;
  status: GameSessionStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  cashedOutAt?: string;
  cashedOutCredits?: number;
}
