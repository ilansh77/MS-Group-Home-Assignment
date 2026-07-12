import { GameSession } from './game-session';

export enum CashOutOutcome {
  CashedOut = 'cashed-out',
  NotFound = 'not-found',
  AlreadyCashedOut = 'already-cashed-out',
}

export enum CommitRollOutcome {
  Committed = 'committed',
  VersionConflict = 'version-conflict',
  NotFound = 'not-found',
  AlreadyCashedOut = 'already-cashed-out',
  InsufficientCredits = 'insufficient-credits',
}

export interface CommitRollInput {
  expectedVersion: number;
  credits: number;
  updatedAt: string;
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


export type CommitRollResult =
  | {
      outcome: CommitRollOutcome.Committed;
      version: number;
      credits: number;
    }
  | {
      outcome: CommitRollOutcome.VersionConflict;
    }
  | {
      outcome: CommitRollOutcome.NotFound;
    }
  | {
      outcome: CommitRollOutcome.AlreadyCashedOut;
    }
  | {
      outcome: CommitRollOutcome.InsufficientCredits;
    };

export abstract class SessionRepository {
  abstract create(
    session: GameSession,
    ttlSeconds: number,
  ): Promise<boolean>;

  abstract findById(
    sessionId: string,
  ): Promise<GameSession | null>;

  abstract acquireMutationLock(
    sessionId: string,
    lockToken: string,
    ttlMilliseconds: number,
  ): Promise<boolean>;

  abstract releaseMutationLock(
    sessionId: string,
    lockToken: string,
  ): Promise<void>;

  abstract cashOut(
    sessionId: string,
    cashedOutAt: string,
  ): Promise<CashOutSessionResult>;

  abstract commitRoll(
  sessionId: string,
  input: CommitRollInput,
): Promise<CommitRollResult>;
}