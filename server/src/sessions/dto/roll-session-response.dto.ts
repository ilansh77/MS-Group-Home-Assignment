import type {
  SlotSymbols,
} from '../../game/game.types';

export class RollSessionResponseDto {
  symbols!: SlotSymbols;
  won!: boolean;
  reward!: number;
  credits!: number;
}