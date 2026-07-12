import type {
  SlotSymbols,
} from '../../game/game.types';

export class RollSessionResponseDto {
  sessionId!: string;
  symbols!: SlotSymbols;
  won!: boolean;
  reward!: number;
  credits!: number;
}