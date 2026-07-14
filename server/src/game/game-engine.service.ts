import { Injectable,
    Logger,
} from '@nestjs/common';
import {
  SLOT_SYMBOLS,
  SYMBOL_REWARDS,
  type GameRollResult,
  type SlotSymbols,
} from './game.types';
import { RandomSource } from './random-source';

const ROLL_COST = 1;
const MEDIUM_REROLL_PROBABILITY = 0.3;
const HIGH_REROLL_PROBABILITY = 0.6;

@Injectable()
export class GameEngineService {
  private readonly logger = new Logger(GameEngineService.name);

  constructor(
    private readonly randomSource: RandomSource,
  ) {}

  roll(currentCredits: number): GameRollResult {
    if (
      !Number.isInteger(currentCredits) ||
      currentCredits < ROLL_COST
    ) {
      throw new RangeError(
        'At least one credit is required to roll',
      );
    }

    const initialSymbols = this.generateSymbols();
    const rerollProbability =
      this.getRerollProbability(currentCredits);

    const rerolled =
      this.isWinningResult(initialSymbols) &&
      rerollProbability > 0 &&
      this.randomSource.chance(
        rerollProbability,
      );

    // Exactly one reroll is allowed.
    const finalSymbols = rerolled
      ? this.generateSymbols()
      : initialSymbols;

    if(rerolled){
          this.logger.log(
      [
        'House reroll applied',
        `startingCredits=${currentCredits}`,
        `initialSymbols=${initialSymbols.join('')}`,
        `finalSymbols=${finalSymbols.join('')}`,
        `finalWon=${this.isWinningResult(finalSymbols)}`,
      ].join(' | '),
    );
    }

    const won = this.isWinningResult(finalSymbols);

    const reward = won
      ? SYMBOL_REWARDS[finalSymbols[0]]
      : 0;

    return {
      symbols: finalSymbols,
      won,
      reward,
      credits:
        currentCredits - ROLL_COST + reward,
      rerolled,
    };
  }

  private generateSymbols(): SlotSymbols {
    return [
      this.generateSymbol(),
      this.generateSymbol(),
      this.generateSymbol(),
    ];
  }

  private generateSymbol() {
    const index = this.randomSource.integer(
      SLOT_SYMBOLS.length,
    );

    return SLOT_SYMBOLS[index];
  }

  private isWinningResult(
    symbols: SlotSymbols,
  ): boolean {
    return (
      symbols[0] === symbols[1] &&
      symbols[1] === symbols[2]
    );
  }

  private getRerollProbability(
    credits: number,
  ): number {
    if (credits < 40) {
      return 0;
    }

    if (credits <= 60) {
      return MEDIUM_REROLL_PROBABILITY;
    }

    return HIGH_REROLL_PROBABILITY;
  }
}