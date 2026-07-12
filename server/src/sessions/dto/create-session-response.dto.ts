import { GameSessionStatus } from '../game-session';

export class CreateSessionResponseDto {
  credits!: number;
  status!: GameSessionStatus.Active;
}
