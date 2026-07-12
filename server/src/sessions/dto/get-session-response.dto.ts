import { GameSessionStatus } from '../game-session';

export class GetSessionResponseDto {
  credits!: number;
  status!: GameSessionStatus;
  createdAt!: string;
  updatedAt!: string;
  cashedOutAt?: string;
  cashedOutCredits?: number;
}