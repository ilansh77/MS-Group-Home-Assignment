import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { CreateSessionResponseDto } from './dto/create-session-response.dto';
import { GameSessionStatus, type GameSession } from './game-session';
import { CashOutSessionResponseDto } from './dto/cash-out-session-response.dto';
import { CashOutOutcome, SessionRepository } from './session.repository';
import { GetSessionResponseDto } from './dto/get-session-response.dto';

const INITIAL_CREDITS = 10;
const DEFAULT_SESSION_TTL_SECONDS = 86_400;
const MAX_SESSION_CREATION_ATTEMPTS = 3;

@Injectable()
export class SessionsService {
  private readonly sessionTtlSeconds: number;

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly configService: ConfigService,
  ) {
    this.sessionTtlSeconds = this.readSessionTtl();
  }

  async createSession(): Promise<CreateSessionResponseDto> {
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
    sessionId: session.id,
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
  const result = await this.sessionRepository.cashOut(
    sessionId,
    new Date().toISOString(),
  );

  switch (result.outcome) {
    case CashOutOutcome.CashedOut:
      return {
        sessionId,
        cashedOutCredits: result.cashedOutCredits,
        status: GameSessionStatus.CashedOut,
      };

    case 'not-found':
      throw new NotFoundException({
        statusCode: 404,
        code: 'SESSION_NOT_FOUND',
        message:
          'The requested game session does not exist or has expired.',
      });

    case 'already-cashed-out':
      throw new ConflictException({
        statusCode: 409,
        code: 'SESSION_ALREADY_CASHED_OUT',
        message:
          'The game session has already been cashed out.',
      });

    default:
      throw new Error(
        `Unhandled cash-out outcome: ${String(result)}`,
      );
  }
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
  
}
