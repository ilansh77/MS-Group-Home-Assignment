import { GameSessionStatus } from "../game-session";

export class CashOutSessionResponseDto {
  cashedOutCredits!: number;
  status!: GameSessionStatus.CashedOut;
}