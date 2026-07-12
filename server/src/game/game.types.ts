export enum SlotSymbol {
  Cherry = 'C',
  Lemon = 'L',
  Orange = 'O',
  Watermelon = 'W',
}

export type SlotSymbols = [
  SlotSymbol,
  SlotSymbol,
  SlotSymbol,
];

export interface GameRollResult {
  symbols: SlotSymbols;
  won: boolean;
  reward: number;
  credits: number;
  rerolled: boolean;
}

export const SLOT_SYMBOLS: readonly SlotSymbol[] = [
  SlotSymbol.Cherry,
  SlotSymbol.Lemon,
  SlotSymbol.Orange,
  SlotSymbol.Watermelon,
];

export const SYMBOL_REWARDS: Readonly<
  Record<SlotSymbol, number>
> = {
  [SlotSymbol.Cherry]: 10,
  [SlotSymbol.Lemon]: 20,
  [SlotSymbol.Orange]: 30,
  [SlotSymbol.Watermelon]: 40,
};