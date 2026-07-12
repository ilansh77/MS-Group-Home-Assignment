import { ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { CreateSessionResponseDto } from './dto/create-session-response.dto';
import { GameSessionStatus, type GameSession } from './game-session';
import { CashOutSessionResponseDto } from './dto/cash-out-session-response.dto';
import { CashOutOutcome, CommitRollOutcome, SessionRepository } from './session.repository';
import { GetSessionResponseDto } from './dto/get-session-response.dto';
import { GameEngineService } from '../game/game-engine.service';
import { RollSessionResponseDto } from './dto/roll-session-response.dto';

export interface CreatedSessionResult {
  sessionId: string;
  credits: number;
  status: GameSessionStatus.Active;
}

const INITIAL_CREDITS = 10;
const DEFAULT_SESSION_TTL_SECONDS = 86_400;
const MAX_SESSION_CREATION_ATTEMPTS = 3;
const SESSION_MUTATION_LOCK_TTL_MILLISECONDS = 10_000;

@Injectable()
export class SessionsService {
  private readonly sessionTtlSeconds: number;
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly configService: ConfigService,
    private readonly gameEngine: GameEngineService
    ) {
    this.sessionTtlSeconds = this.readSessionTtl();
  }

  async createSession(): Promise<CreatedSessionResult> {
    for (
      let attempt = 0;
      attempt < MAX_SESSION_CREATION_ATTEMPTS;
      attempt += 1
    ) {
      const session = this.buildSession();

      const created = await this.sessionRepository.create(
        session,
        this.sessionTtlSeconds,
      );

      if (created) {
        return {
          sessionId: session.id,
          credits: session.credits,
          status: session.status as GameSessionStatus.Active,
        };
      }
    }

    throw new ServiceUnavailableException({
      statusCode: 503,
      code: 'SESSION_CREATION_FAILED',
      message: 'Unable to create a game session.',
    });
  }

  async getSession(
  sessionId: string,
): Promise<GetSessionResponseDto> {
  const session =
    await this.sessionRepository.findById(sessionId);

  if (!session) {
    throw new NotFoundException({
      statusCode: 404,
      code: 'SESSION_NOT_FOUND',
      message:
        'The requested game session does not exist or has expired.',
    });
  }

  return {
    credits: session.credits,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    cashedOutAt: session.cashedOutAt,
    cashedOutCredits: session.cashedOutCredits,
  };
}

async cashOutSession(
  sessionId: string,
): Promise<CashOutSessionResponseDto> {
  return this.withSessionMutationLock(
    sessionId,
    () => this.executeCashOut(sessionId),
  );
}

  async rollSession(
    sessionId: string,  
  ): Promise<RollSessionResponseDto> {
    return this.withSessionMutationLock(
      sessionId,
      () => this.executeRoll(sessionId),
    );
  }

  private buildSession(): GameSession {
    const timestamp = new Date().toISOString();

    return {
      id: randomUUID(),
      credits: INITIAL_CREDITS,
      status: GameSessionStatus.Active,
      version:0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private readSessionTtl(): number {
    const configuredValue = this.configService.get<string>(
      'SESSION_TTL_SECONDS',
    );

    const ttlSeconds = configuredValue
      ? Number(configuredValue)
      : DEFAULT_SESSION_TTL_SECONDS;

    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error(
        `Invalid SESSION_TTL_SECONDS configuration: ${configuredValue}`,
      );
    }

    return ttlSeconds;
  }

  private validateRollableSession(
  session: GameSession | null,
): asserts session is GameSession {
  if (!session) {
    this.throwSessionNotFound();
  }

  if (
    session.status !== GameSessionStatus.Active
  ) {
    this.throwSessionAlreadyCashedOut();
  }

  if (session.credits < 1) {
    this.throwInsufficientCredits();
  }
}

private throwSessionNotFound(): never {
  throw new NotFoundException({
    statusCode: 404,
    code: 'SESSION_NOT_FOUND',
    message:
      'The requested game session does not exist or has expired.',
  });
}

private throwSessionAlreadyCashedOut(): never {
  throw new ConflictException({
    statusCode: 409,
    code: 'SESSION_ALREADY_CASHED_OUT',
    message:
      'The game session has already been cashed out.',
  });
}

private throwInsufficientCredits(): never {
  throw new UnprocessableEntityException({
    statusCode: 422,
    code: 'INSUFFICIENT_CREDITS',
    message:
      'The game session does not have enough credits to roll.',
  });
}

private async withSessionMutationLock<T>(
  sessionId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const lockToken = randomUUID();

  const lockAcquired =
    await this.sessionRepository.acquireMutationLock(
      sessionId,
      lockToken,
      SESSION_MUTATION_LOCK_TTL_MILLISECONDS,
    );

  if (!lockAcquired) {
    throw new ConflictException({
      statusCode: 409,
      code: 'SESSION_OPERATION_IN_PROGRESS',
      message:
        'Another operation is already in progress for this session.',
    });
  }

  try {
    return await operation();
  } finally {
    try {
      await this.sessionRepository.releaseMutationLock(
        sessionId,
        lockToken,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      this.logger.error(
        `Failed to release mutation lock for session ${sessionId}: ${message}`,
      );
    }
  }
}

private async executeCashOut(
  sessionId: string,
): Promise<CashOutSessionResponseDto> {
  const result =
    await this.sessionRepository.cashOut(
      sessionId,
      new Date().toISOString(),
    );

  switch (result.outcome) {
    case CashOutOutcome.CashedOut:
      return {
        cashedOutCredits:
          result.cashedOutCredits,
        status:
          GameSessionStatus.CashedOut,
      };

    case CashOutOutcome.NotFound:
      this.throwSessionNotFound();

    case CashOutOutcome.AlreadyCashedOut:
      this.throwSessionAlreadyCashedOut();

    default:
      throw new Error(
        `Unhandled cash-out outcome: ${String(
          result,
        )}`,
      );
  }
}

private async executeRoll(
  sessionId: string,
): Promise<RollSessionResponseDto> {
  const session =
    await this.sessionRepository.findById(
      sessionId,
    );

  this.validateRollableSession(session);

  const roll = this.gameEngine.roll(
    session.credits,
  );

  const commitResult =
    await this.sessionRepository.commitRoll(
      sessionId,
      {
        expectedVersion: session.version,
        credits: roll.credits,
        updatedAt: new Date().toISOString(),
      },
    );

  switch (commitResult.outcome) {
    case CommitRollOutcome.Committed:
      return {
        symbols: roll.symbols,
        won: roll.won,
        reward: roll.reward,
        credits: commitResult.credits,
      };

    case CommitRollOutcome.NotFound:
      this.throwSessionNotFound();

    case CommitRollOutcome.AlreadyCashedOut:
      this.throwSessionAlreadyCashedOut();

    case CommitRollOutcome.InsufficientCredits:
      this.throwInsufficientCredits();

    case CommitRollOutcome.VersionConflict:
      throw new ConflictException({
        statusCode: 409,
        code: 'SESSION_STATE_CONFLICT',
        message:
          'The session changed while the roll was being processed.',
      });

    default:
      throw new Error(
        `Unhandled roll outcome: ${String(
          commitResult,
        )}`,
      );
  }
}
  
}
