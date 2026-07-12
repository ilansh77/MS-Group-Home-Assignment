export abstract class RandomSource {
  abstract integer(maxExclusive: number): number;

  abstract chance(probability: number): boolean;
}