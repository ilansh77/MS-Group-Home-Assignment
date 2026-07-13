export enum GameSessionStatus {
  Active = 'active',
  CashedOut = 'cashed-out',
}

export enum SlotSymbol {
  Cherry = 'C',
  Lemon = 'L',
  Orange = 'O',
  Watermelon = 'W',
}

export type SlotSymbols = readonly [
  SlotSymbol,
  SlotSymbol,
  SlotSymbol,
];

export interface SessionState {
  credits: number;
  status: GameSessionStatus;
  createdAt?: string;
  updatedAt?: string;
  cashedOutAt?: string;
  cashedOutCredits?: number;
}

export interface RollSessionResponse {
  symbols: SlotSymbols;
  won: boolean;
  reward: number;
  credits: number;
}

export interface CashOutSessionResponse {
  cashedOutCredits: number;
  status: GameSessionStatus.CashedOut;
}