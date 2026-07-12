import { GameSessionStatus } from '../game-session';

export class CreateSessionResponseDto {
  sessionId!: string;
  credits!: number;
  status!: GameSessionStatus.Active;
}
