import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { GameSession, GameSessionStatus } from './game-session';
import {
  CashOutOutcome,
  CommitRollInput,
  CommitRollOutcome,
  CommitRollResult,
  SessionRepository,
  type CashOutSessionResult,
} from './session.repository';

const CASH_OUT_SCRIPT = `
  local sessionJson = redis.call("GET", KEYS[1])

  if not sessionJson then
    return { "NOT_FOUND" }
  end

  local session = cjson.decode(sessionJson)

  if session.status ~= "active" then
    return { "ALREADY_CASHED_OUT" }
  end

  local ttl = redis.call("PTTL", KEYS[1])

  if ttl == -2 or ttl == 0 then
    return { "NOT_FOUND" }
  end

  local payout = tonumber(session.credits) or 0
  local currentVersion = tonumber(session.version) or 0

  session.credits = 0
  session.status = "cashed-out"
  session.version = currentVersion + 1
  session.updatedAt = ARGV[1]
  session.cashedOutAt = ARGV[1]
  session.cashedOutCredits = payout

  local updatedSession = cjson.encode(session)

  if ttl > 0 then
    redis.call("SET", KEYS[1], updatedSession, "PX", ttl)
  else
    redis.call("SET", KEYS[1], updatedSession)
  end

  return {
    "CASHED_OUT",
    payout,
    session.version
  }
`;

const COMMIT_ROLL_SCRIPT = `
  local sessionJson = redis.call("GET", KEYS[1])

  if not sessionJson then
    return { "NOT_FOUND" }
  end

  local session = cjson.decode(sessionJson)

  if session.status ~= ARGV[4] then
    return { "ALREADY_CASHED_OUT" }
  end

  local currentCredits =
    tonumber(session.credits) or 0

  if currentCredits < 1 then
    return { "INSUFFICIENT_CREDITS" }
  end

  local currentVersion =
    tonumber(session.version) or 0

  local expectedVersion =
    tonumber(ARGV[1])

  if currentVersion ~= expectedVersion then
    return { "VERSION_CONFLICT" }
  end

  local newCredits = tonumber(ARGV[2])

  if not newCredits or newCredits < 0 then
    return { "INVALID_CREDITS" }
  end

  local ttl = redis.call("PTTL", KEYS[1])

  if ttl == -2 or ttl == 0 then
    return { "NOT_FOUND" }
  end

  session.credits = newCredits
  session.version = currentVersion + 1
  session.updatedAt = ARGV[3]

  local updatedSession = cjson.encode(session)

  if ttl > 0 then
    redis.call(
      "SET",
      KEYS[1],
      updatedSession,
      "PX",
      ttl
    )
  else
    redis.call(
      "SET",
      KEYS[1],
      updatedSession
    )
  end

  return {
    "COMMITTED",
    session.version,
    session.credits
  }
`;

const RELEASE_SESSION_MUTATION_LOCK_SCRIPT = `
  local currentToken = redis.call("GET", KEYS[1])

  if currentToken == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  end

  return 0
`;

@Injectable()
export class RedisSessionRepository extends SessionRepository {
  private static readonly KEY_PREFIX = 'casino:session:';
  private static readonly MUTATION_LOCK_KEY_PREFIX = 'casino:session-mutation-lock:';

  constructor(
    private readonly redisService: RedisService,
  ) {
    super();
  }

  async create(
    session: GameSession,
    ttlSeconds: number,
  ): Promise<boolean> {
    const key = RedisSessionRepository.getKey(session.id);

    const result = await this.redisService
      .getClient()
      .set(key, session, {
        ex: ttlSeconds,
        nx: true,
      });

    return result === 'OK';
  }

  async findById(
  sessionId: string,
): Promise<GameSession | null> {
  const key = RedisSessionRepository.getKey(sessionId);

  return this.redisService
    .getClient()
    .get<GameSession>(key);
  }

  async acquireMutationLock(
    sessionId: string,
    lockToken: string,
    ttlMilliseconds: number,
  ): Promise<boolean> {
    const key =
      RedisSessionRepository.getMutationLockKey(
        sessionId,
      );

    const result = await this.redisService
      .getClient()
      .set(key, lockToken, {
        nx: true,
        px: ttlMilliseconds,
      });

    return result === 'OK';
  }

  async releaseMutationLock(
    sessionId: string,
    lockToken: string,
  ): Promise<void> {
    const key =
      RedisSessionRepository.getMutationLockKey(
        sessionId,
      );

    await this.redisService
      .getClient()
      .eval(
        RELEASE_SESSION_MUTATION_LOCK_SCRIPT,
        [key],
        [lockToken],
      );
  }

  async cashOut(
    sessionId: string,
    cashedOutAt: string,
  ): Promise<CashOutSessionResult> {
    const key = RedisSessionRepository.getKey(sessionId);

    const result: unknown = await this.redisService
      .getClient()
      .eval(CASH_OUT_SCRIPT, [key], [cashedOutAt]);

    return this.parseCashOutResult(result);
  }

  async commitRoll(
  sessionId: string,
  input: CommitRollInput,
): Promise<CommitRollResult> {
  const key =
    RedisSessionRepository.getKey(sessionId);

  const result: unknown = await this.redisService
    .getClient()
    .eval(
      COMMIT_ROLL_SCRIPT,
      [key],
      [
        input.expectedVersion,
        input.credits,
        input.updatedAt,
        GameSessionStatus.Active,
      ],
    );

  return this.parseCommitRollResult(result);
}

  private parseCashOutResult(
    result: unknown,
  ): CashOutSessionResult {
    if (
      !Array.isArray(result) ||
      result.length === 0 ||
      typeof result[0] !== 'string'
    ) {
      throw new Error(
        'Redis returned an invalid cash-out result',
      );
    }

    switch (result[0]) {
      case 'NOT_FOUND':
        return {
          outcome: CashOutOutcome.NotFound,
        };

      case 'ALREADY_CASHED_OUT':
        return {
          outcome: CashOutOutcome.AlreadyCashedOut,
        };

      case 'CASHED_OUT':
        return {
          outcome: CashOutOutcome.CashedOut,
          cashedOutCredits: this.parseNonNegativeInteger(
            result[1],
            'cashed-out credits',
          ),
        };

      default:
        throw new Error(
          `Redis returned an unknown cash-out result: ${result[0]}`,
        );
    }
  }

  private parseNonNegativeInteger(
    value: unknown,
    fieldName: string,
  ): number {
    const parsedValue =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : Number.NaN;

    if (
      !Number.isInteger(parsedValue) ||
      parsedValue < 0
    ) {
      throw new Error(
        `Redis returned invalid ${fieldName}`,
      );
    }

    return parsedValue;
  }

  private static getKey(sessionId: string): string {
    return `${RedisSessionRepository.KEY_PREFIX}${sessionId}`;
  }

  private parseCommitRollResult(
  result: unknown,
): CommitRollResult {
  if (
    !Array.isArray(result) ||
    result.length === 0 ||
    typeof result[0] !== 'string'
  ) {
    throw new Error(
      'Redis returned an invalid roll result',
    );
  }

  switch (result[0]) {
    case 'COMMITTED':
      return {
        outcome: CommitRollOutcome.Committed,
        version: this.parseNonNegativeInteger(
          result[1],
          'session version',
        ),
        credits: this.parseNonNegativeInteger(
          result[2],
          'session credits',
        ),
      };

    case 'VERSION_CONFLICT':
      return {
        outcome:
          CommitRollOutcome.VersionConflict,
      };

    case 'NOT_FOUND':
      return {
        outcome: CommitRollOutcome.NotFound,
      };

    case 'ALREADY_CASHED_OUT':
      return {
        outcome:
          CommitRollOutcome.AlreadyCashedOut,
      };

    case 'INSUFFICIENT_CREDITS':
      return {
        outcome:
          CommitRollOutcome.InsufficientCredits,
      };

    case 'INVALID_CREDITS':
      throw new Error(
        'Redis rejected the calculated credit balance',
      );

    default:
      throw new Error(
        `Redis returned an unknown roll result: ${result[0]}`,
      );
  }
  }
  private static getMutationLockKey(
  sessionId: string,
  ): string {
    return `${RedisSessionRepository.MUTATION_LOCK_KEY_PREFIX}${sessionId}`;
  }
}