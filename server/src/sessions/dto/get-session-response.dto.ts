import { GameSessionStatus } from '../game-session';

export class GetSessionResponseDto {
  sessionId!: string;
  credits!: number;
  status!: GameSessionStatus;
  createdAt!: string;
  updatedAt!: string;
  cashedOutAt?: string;
  cashedOutCredits?: number;
}