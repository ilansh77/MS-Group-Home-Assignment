import { GameSession } from './game-session';

export enum CashOutOutcome {
  CashedOut = 'cashed-out',
  NotFound = 'not-found',
  AlreadyCashedOut = 'already-cashed-out',
}

export type CashOutSessionResult =
  | {
      outcome: CashOutOutcome.CashedOut;
      cashedOutCredits: number;
    }
  | {
      outcome: CashOutOutcome.NotFound;
    }
  | {
      outcome: CashOutOutcome.AlreadyCashedOut;
    };

export abstract class SessionRepository {
  abstract create(
    session: GameSession,
    ttlSeconds: number,
  ): Promise<boolean>;

  abstract findById(
    sessionId: string,
  ): Promise<GameSession | null>;

  abstract cashOut(
    sessionId: string,
    cashedOutAt: string,
  ): Promise<CashOutSessionResult>;
}