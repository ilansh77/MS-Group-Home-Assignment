import type {
  CookieOptions,
  Response,
} from 'express';
import {
  SlotSymbol,
} from '../game/game.types';
import {
  GameSessionStatus,
} from './game-session';
import {
  SessionsController,
} from './sessions.controller';
import {
  SessionsService,
} from './sessions.service';
import { SessionCookieOptionsService } from './session-cookie-options.service';
import { RollSessionResponseDto } from './dto/roll-session-response.dto';
import { CashOutSessionResponseDto } from './dto/cash-out-session-response.dto';

type SessionsServiceMock = {
  createSession: jest.MockedFunction<
    SessionsService['createSession']
  >;
  getSession: jest.MockedFunction<
    SessionsService['getSession']
  >;
  rollSession: jest.MockedFunction<
    SessionsService['rollSession']
  >;
  cashOutSession: jest.MockedFunction<
    SessionsService['cashOutSession']
  >;
};

type CookieOptionsServiceMock = {
  getSessionCookieOptions:
    jest.MockedFunction<
      SessionCookieOptionsService[
        'getSessionCookieOptions'
      ]
    >;
};

describe('SessionsController', () => {
  const sessionId =
    'faae3a7b-9726-4819-a7fa-64ac0cd5ae37';

  const createdAt =
    '2026-07-14T10:00:00.000Z';

  const updatedAt =
    '2026-07-14T10:05:00.000Z';

  const cashedOutAt =
    '2026-07-14T10:10:00.000Z';

  const creationCookieOptions:
    CookieOptions = {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/api/sessions',
      maxAge: 86_400_000,
    };

  const clearingCookieOptions:
    CookieOptions = {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/api/sessions',
    };

  let controller: SessionsController;

  let sessionsServiceMock:
    SessionsServiceMock;

  let cookieOptionsServiceMock:
    CookieOptionsServiceMock;

  beforeEach(() => {
    sessionsServiceMock = {
      createSession: jest.fn(),
      getSession: jest.fn(),
      rollSession: jest.fn(),
      cashOutSession: jest.fn(),
    };

    cookieOptionsServiceMock = {
      getSessionCookieOptions:
        jest.fn(
          (
            includeLifetime: boolean,
          ): CookieOptions =>
            includeLifetime
              ? creationCookieOptions
              : clearingCookieOptions,
        ),
    };

    controller = new SessionsController(
      sessionsServiceMock as unknown as SessionsService,
      cookieOptionsServiceMock as unknown as SessionCookieOptionsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('creates a session, writes its ID to a cookie, and returns the public session data', async () => {
      sessionsServiceMock.createSession
        .mockResolvedValue({
          sessionId,
          credits: 10,
          status:
            GameSessionStatus.Active,
        });

      const response = {
        cookie: jest.fn(),
      } as unknown as Response;

      await expect(
        controller.createSession(response),
      ).resolves.toEqual({
        credits: 10,
        status:
          GameSessionStatus.Active,
      });

      expect(
        sessionsServiceMock.createSession,
      ).toHaveBeenCalledTimes(1);

      expect(
        cookieOptionsServiceMock
          .getSessionCookieOptions,
      ).toHaveBeenCalledTimes(1);

      expect(
        cookieOptionsServiceMock
          .getSessionCookieOptions,
      ).toHaveBeenCalledWith(true);

      expect(
        response.cookie,
      ).toHaveBeenCalledTimes(1);

      expect(
        response.cookie,
      ).toHaveBeenCalledWith(
        SessionCookieOptionsService
          .COOKIE_NAME,
        sessionId,
        creationCookieOptions,
      );
    });

    it('does not expose the session ID in the response body', async () => {
      sessionsServiceMock.createSession
        .mockResolvedValue({
          sessionId,
          credits: 10,
          status:
            GameSessionStatus.Active,
        });

      const response = {
        cookie: jest.fn(),
      } as unknown as Response;

      const result =
        await controller.createSession(
          response,
        );

      expect(result).not.toHaveProperty(
        'sessionId',
      );

      expect(result).toEqual({
        credits: 10,
        status:
          GameSessionStatus.Active,
      });
    });

    it('does not set a cookie when session creation fails', async () => {
      const creationError =
        new Error(
          'Unable to create session',
        );

      sessionsServiceMock.createSession
        .mockRejectedValue(
          creationError,
        );

      const response = {
        cookie: jest.fn(),
      } as unknown as Response;

      await expect(
        controller.createSession(response),
      ).rejects.toBe(creationError);

      expect(
        response.cookie,
      ).not.toHaveBeenCalled();

      expect(
        cookieOptionsServiceMock
          .getSessionCookieOptions,
      ).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentSession', () => {
    it('passes the validated cookie session ID to the service', async () => {
      const serviceResponse = {
        credits: 10,
        status:
          GameSessionStatus.Active,
        createdAt,
        updatedAt,
      };

      sessionsServiceMock.getSession
        .mockResolvedValue(
          serviceResponse,
        );

      await expect(
        controller.getCurrentSession(
          sessionId,
        ),
      ).resolves.toEqual(
        serviceResponse,
      );

      expect(
        sessionsServiceMock.getSession,
      ).toHaveBeenCalledTimes(1);

      expect(
        sessionsServiceMock.getSession,
      ).toHaveBeenCalledWith(
        sessionId,
      );
    });

    it('returns a cashed-out session response', async () => {
      const serviceResponse = {
        credits: 0,
        status:
          GameSessionStatus.CashedOut,
        createdAt,
        updatedAt,
        cashedOutAt,
        cashedOutCredits: 25,
      };

      sessionsServiceMock.getSession
        .mockResolvedValue(
          serviceResponse,
        );

      await expect(
        controller.getCurrentSession(
          sessionId,
        ),
      ).resolves.toEqual(
        serviceResponse,
      );
    });

    it('propagates errors from the service', async () => {
      const serviceError =
        new Error(
          'Session not found',
        );

      sessionsServiceMock.getSession
        .mockRejectedValue(
          serviceError,
        );

      await expect(
        controller.getCurrentSession(
          sessionId,
        ),
      ).rejects.toBe(serviceError);
    });
  });

  describe('rollCurrentSession', () => {
    it('passes the validated cookie session ID to the service and returns the roll', async () => {
      const serviceResponse = {
        symbols: [
          SlotSymbol.Cherry,
          SlotSymbol.Cherry,
          SlotSymbol.Cherry,
        ] as const,
        won: true,
        reward: 10,
        credits: 19,
      };

      sessionsServiceMock.rollSession
        .mockResolvedValue(
          serviceResponse as RollSessionResponseDto,
        );

      await expect(
        controller.rollCurrentSession(
          sessionId,
        ),
      ).resolves.toEqual(
        serviceResponse,
      );

      expect(
        sessionsServiceMock.rollSession,
      ).toHaveBeenCalledTimes(1);

      expect(
        sessionsServiceMock.rollSession,
      ).toHaveBeenCalledWith(
        sessionId,
      );
    });

    it('returns a losing roll response', async () => {
      const serviceResponse = {
        symbols: [
          SlotSymbol.Cherry,
          SlotSymbol.Lemon,
          SlotSymbol.Orange,
        ] as const,
        won: false,
        reward: 0,
        credits: 9,
      };

      sessionsServiceMock.rollSession
        .mockResolvedValue(
          serviceResponse as RollSessionResponseDto,
        );

      await expect(
        controller.rollCurrentSession(
          sessionId,
        ),
      ).resolves.toEqual(
        serviceResponse,
      );
    });

    it('propagates roll errors from the service', async () => {
      const serviceError =
        new Error(
          'Roll failed',
        );

      sessionsServiceMock.rollSession
        .mockRejectedValue(
          serviceError,
        );

      await expect(
        controller.rollCurrentSession(
          sessionId,
        ),
      ).rejects.toBe(serviceError);
    });
  });

  describe('cashOutCurrentSession', () => {
    it('passes the validated cookie session ID to the service and returns the payout', async () => {
      const serviceResponse = {
        cashedOutCredits: 25,
        status:
          GameSessionStatus.CashedOut,
      };

      sessionsServiceMock.cashOutSession
        .mockResolvedValue(
          serviceResponse as CashOutSessionResponseDto,
        );

      await expect(
        controller.cashOutCurrentSession(
          sessionId,
        ),
      ).resolves.toEqual(
        serviceResponse,
      );

      expect(
        sessionsServiceMock
          .cashOutSession,
      ).toHaveBeenCalledTimes(1);

      expect(
        sessionsServiceMock
          .cashOutSession,
      ).toHaveBeenCalledWith(
        sessionId,
      );
    });

    it('propagates cash-out errors from the service', async () => {
      const serviceError =
        new Error(
          'Cash-out failed',
        );

      sessionsServiceMock.cashOutSession
        .mockRejectedValue(
          serviceError,
        );

      await expect(
        controller.cashOutCurrentSession(
          sessionId,
        ),
      ).rejects.toBe(serviceError);
    });
  });

  describe('clearCurrentSession', () => {
    it('clears the session cookie using clearing options', () => {
      const response = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      expect(
        controller.clearCurrentSession(
          response,
        ),
      ).toBeUndefined();

      expect(
        cookieOptionsServiceMock
          .getSessionCookieOptions,
      ).toHaveBeenCalledTimes(1);

      expect(
        cookieOptionsServiceMock
          .getSessionCookieOptions,
      ).toHaveBeenCalledWith(false);

      expect(
        response.clearCookie,
      ).toHaveBeenCalledTimes(1);

      expect(
        response.clearCookie,
      ).toHaveBeenCalledWith(
        SessionCookieOptionsService
          .COOKIE_NAME,
        clearingCookieOptions,
      );
    });

    it('does not invoke the session business service when clearing the cookie', () => {
      const response = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      controller.clearCurrentSession(
        response,
      );

      expect(
        sessionsServiceMock.createSession,
      ).not.toHaveBeenCalled();

      expect(
        sessionsServiceMock.getSession,
      ).not.toHaveBeenCalled();

      expect(
        sessionsServiceMock.rollSession,
      ).not.toHaveBeenCalled();

      expect(
        sessionsServiceMock
          .cashOutSession,
      ).not.toHaveBeenCalled();
    });
  });
});