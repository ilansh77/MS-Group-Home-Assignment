import {
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { GameSessionStatus } from '../../../sessions/game-session';
import {
  SessionsController,
} from '../../../sessions/sessions.controller';
import {
  SessionsService,
} from '../../../sessions/sessions.service';
import { SessionCookieOptionsService } from '../../../sessions/session-cookie-options.service';

describe('Session cookie routes', () => {
  let app: INestApplication;

  const sessionsServiceMock = {
    createSession: jest.fn(),
    getSession: jest.fn(),
    rollSession: jest.fn(),
    cashOutSession: jest.fn(),
  };

  const sessionCookieOptionsServiceMock = {
    getSessionCookieOptions: jest.fn(
      (includeLifetime: boolean) => ({
        httpOnly: true,
        secure: false,
        sameSite: 'lax' as const,
        path:
          SessionCookieOptionsService
            .COOKIE_PATH,
        ...(includeLifetime
          ? {
              maxAge: 86_400_000,
            }
          : {}),
      }),
    ),
  };

  beforeAll(async () => {
    const moduleRef =
      await Test.createTestingModule({
        controllers: [
          SessionsController,
        ],
        providers: [
          {
            provide: SessionsService,
            useValue: sessionsServiceMock,
          },
          {
            provide:
              SessionCookieOptionsService,
            useValue:
              sessionCookieOptionsServiceMock,
          },
        ],
      }).compile();

    app =
      moduleRef.createNestApplication();

    app.use(cookieParser());
    app.setGlobalPrefix('api');

    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('extracts the session ID from the cookie', async () => {
    const sessionId =
      'faae3a7b-9726-4819-a7fa-64ac0cd5ae37';

    sessionsServiceMock.getSession
      .mockResolvedValue({
        credits: 10,
        status:
          GameSessionStatus.Active,
        createdAt:
          '2026-07-13T10:00:00.000Z',
        updatedAt:
          '2026-07-13T10:00:00.000Z',
      });

    await request(app.getHttpServer())
      .get('/api/sessions/current')
      .set(
        'Cookie',
        `${
          SessionCookieOptionsService
            .COOKIE_NAME
        }=${sessionId}`,
      )
      .expect(200);

    expect(
      sessionsServiceMock.getSession,
    ).toHaveBeenCalledWith(sessionId);
  });

  it('returns 204 when the session cookie is missing', async () => {
    await request(app.getHttpServer())
      .get('/api/sessions/current')
      .expect(204);

    expect(
      sessionsServiceMock.getSession,
    ).not.toHaveBeenCalled();
  });

  it('rejects a malformed session cookie', async () => {
    const response =
      await request(
        app.getHttpServer(),
      )
        .get('/api/sessions/current')
        .set(
          'Cookie',
          `${
            SessionCookieOptionsService
              .COOKIE_NAME
          }=invalid`,
        )
        .expect(401);

    expect(response.body).toMatchObject({
      code: 'INVALID_SESSION_COOKIE',
    });

    expect(
      sessionsServiceMock.getSession,
    ).not.toHaveBeenCalled();
  });

  it('rejects a roll request when the session cookie is missing', async () => {
  const response =
    await request(app.getHttpServer())
      .post(
        '/api/sessions/current/roll',
      )
      .expect(401);

  expect(response.body).toMatchObject({
    code:
      'SESSION_COOKIE_MISSING',
  });

  expect(
    sessionsServiceMock.rollSession,
  ).not.toHaveBeenCalled();
});
});