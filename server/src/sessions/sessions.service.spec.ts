import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GameSessionStatus, type GameSession } from './game-session';
import { RedisSessionRepository } from './redis-session.repository';
import { SessionsService } from './sessions.service';
import { CashOutOutcome, CashOutSessionResult } from './session.repository';

describe('SessionsService', () => {
  let sessionsService: SessionsService;

  const sessionRepositoryMock = {
    create: jest.fn<
      Promise<boolean>,
      [GameSession, number]
    >(),

    findById: jest.fn<
      Promise<GameSession | null>,
      [string]
    >(),

    cashOut: jest.fn<
      Promise<CashOutSessionResult>,
      [string, string]
    >(),
  };

  const configServiceMock = {
    get: jest.fn<
      string | undefined,
      [string]
    >(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    sessionRepositoryMock.create.mockReset();
    sessionRepositoryMock.findById.mockReset();
    sessionRepositoryMock.cashOut.mockReset();
    configServiceMock.get.mockReset();

    configServiceMock.get.mockReturnValue('86400');
    sessionRepositoryMock.create.mockResolvedValue(true);

    sessionsService = new SessionsService(
      sessionRepositoryMock as unknown as RedisSessionRepository,
      configServiceMock as unknown as ConfigService,
    );
  });

  describe('createSession', () => {
    it('creates an active session with 10 credits', async () => {
      sessionRepositoryMock.create.mockResolvedValueOnce(true);

      const result = await sessionsService.createSession();

      expect(result).toEqual({
        sessionId: expect.any(String),
        credits: 10,
        status: GameSessionStatus.Active,
      });

      expect(sessionRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          credits: 10,
          status: GameSessionStatus.Active,
          version: 0,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        }),
        86_400,
      );
    });

    it('retries when the generated session key already exists', async () => {
      sessionRepositoryMock.create
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await sessionsService.createSession();

      expect(sessionRepositoryMock.create).toHaveBeenCalledTimes(2);

      const firstSession = sessionRepositoryMock.create.mock.calls[0][0];

      const secondSession = sessionRepositoryMock.create.mock.calls[1][0];

      expect(firstSession.id).not.toBe(secondSession.id);
    });

    it('throws when session creation repeatedly fails', async () => {
      sessionRepositoryMock.create.mockResolvedValue(false);

      await expect(sessionsService.createSession()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );

      expect(sessionRepositoryMock.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('cashOutSession', () => {
  const sessionId =
    'faae3a7b-9726-4819-a7fa-64ac0cd5ae37';

  it('returns the session payout', async () => {
    sessionRepositoryMock.cashOut.mockResolvedValue({
      outcome: CashOutOutcome.CashedOut,
      cashedOutCredits: 10,
    });

    await expect(
      sessionsService.cashOutSession(sessionId),
    ).resolves.toEqual({
      sessionId,
      cashedOutCredits: 10,
      status: 'cashed-out',
    });

    expect(
      sessionRepositoryMock.cashOut,
    ).toHaveBeenCalledWith(
      sessionId,
      expect.any(String),
    );
  });

  it('throws not found for an unknown session', async () => {
    sessionRepositoryMock.cashOut.mockResolvedValue({
      outcome: CashOutOutcome.NotFound,
    });

    await expect(
      sessionsService.cashOutSession(sessionId),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects a repeated cash-out', async () => {
    sessionRepositoryMock.cashOut.mockResolvedValue({
      outcome: CashOutOutcome.AlreadyCashedOut,
    });

    await expect(
      sessionsService.cashOutSession(sessionId),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('getSession', () => {
  const sessionId =
    'faae3a7b-9726-4819-a7fa-64ac0cd5ae37';

  it('returns an active session', async () => {
    const session: GameSession = {
      id: sessionId,
      credits: 10,
      status: GameSessionStatus.Active,
      version: 0,
      createdAt: '2026-07-12T14:00:00.000Z',
      updatedAt: '2026-07-12T14:00:00.000Z',
    };

    sessionRepositoryMock.findById.mockResolvedValue(
      session,
    );

    await expect(
      sessionsService.getSession(sessionId),
    ).resolves.toEqual({
      sessionId,
      credits: 10,
      status: GameSessionStatus.Active,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      cashedOutAt: undefined,
      cashedOutCredits: undefined,
    });

    expect(
      sessionRepositoryMock.findById,
    ).toHaveBeenCalledWith(sessionId);
  });

  it('returns a cashed-out session', async () => {
    const session: GameSession = {
      id: sessionId,
      credits: 0,
      status: GameSessionStatus.CashedOut,
      version: 1,
      createdAt: '2026-07-12T14:00:00.000Z',
      updatedAt: '2026-07-12T14:10:00.000Z',
      cashedOutAt: '2026-07-12T14:10:00.000Z',
      cashedOutCredits: 10,
    };

    sessionRepositoryMock.findById.mockResolvedValue(
      session,
    );

    await expect(
      sessionsService.getSession(sessionId),
    ).resolves.toEqual({
      sessionId,
      credits: 0,
      status: GameSessionStatus.CashedOut,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      cashedOutAt: session.cashedOutAt,
      cashedOutCredits: 10,
    });
  });

  it('throws not found when the session is missing', async () => {
    sessionRepositoryMock.findById.mockResolvedValue(
      null,
    );

    await expect(
      sessionsService.getSession(sessionId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
});
