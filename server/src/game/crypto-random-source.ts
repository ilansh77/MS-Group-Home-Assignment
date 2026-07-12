import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { RandomSource } from './random-source';

const CHANCE_SCALE = 10_000;

@Injectable()
export class CryptoRandomSource extends RandomSource {
  integer(maxExclusive: number): number {
    if (
      !Number.isInteger(maxExclusive) ||
      maxExclusive <= 0
    ) {
      throw new RangeError(
        'maxExclusive must be a positive integer',
      );
    }

    return randomInt(maxExclusive);
  }

  chance(probability: number): boolean {
    if (
      !Number.isFinite(probability) ||
      probability < 0 ||
      probability > 1
    ) {
      throw new RangeError(
        'probability must be between 0 and 1',
      );
    }

    const threshold = Math.round(
      probability * CHANCE_SCALE,
    );

    return randomInt(CHANCE_SCALE) < threshold;
  }
}