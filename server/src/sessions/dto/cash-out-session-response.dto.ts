import { GameSessionStatus } from "../game-session";

export class CashOutSessionResponseDto {
  sessionId!: string;
  cashedOutCredits!: number;
  status!: GameSessionStatus.CashedOut;
}