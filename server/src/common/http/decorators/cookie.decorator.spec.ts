import {
  type INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { SessionCookiePipe } from '../../../sessions/pipes/session-cookie.pipe';
import { SESSION_COOKIE_NAME } from '../../../sessions/session-cookie.constants';
import { SessionsController } from '../../../sessions/sessions.controller';
import { SessionsService } from '../../../sessions/sessions.service';
import request from 'supertest';
import { GameSessionStatus } from '../../../sessions/game-session';

describe('Session cookie routes', () => {
  let app: INestApplication;

  const sessionsServiceMock = {
    createSession: jest.fn(),
    getSession: jest.fn(),
    rollSession: jest.fn(),
    cashOutSession: jest.fn(),
  };

  const configServiceMock = {
    get: jest.fn(
      (
        key: string,
      ): string | undefined => {
        switch (key) {
          case 'SESSION_TTL_SECONDS':
            return '86400';

          case 'NODE_ENV':
            return 'test';

          default:
            return undefined;
        }
      },
    ),
  };

  beforeAll(async () => {
    const moduleRef =
      await Test.createTestingModule({
        controllers: [
          SessionsController,
        ],
        providers: [
          SessionCookiePipe,
          {
            provide: SessionsService,
            useValue: sessionsServiceMock,
          },
          {
            provide: ConfigService,
            useValue: configServiceMock,
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
        `${SESSION_COOKIE_NAME}=${sessionId}`,
      )
      .expect(200);

    expect(
      sessionsServiceMock.getSession,
    ).toHaveBeenCalledWith(sessionId);
  });

  it('rejects a request without the session cookie', async () => {
    const response =
      await request(
        app.getHttpServer(),
      )
        .get('/api/sessions/current')
        .expect(401);

    expect(response.body).toMatchObject({
      code: 'SESSION_COOKIE_MISSING',
    });

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
          `${SESSION_COOKIE_NAME}=invalid`,
        )
        .expect(401);

    expect(response.body).toMatchObject({
      code: 'INVALID_SESSION_COOKIE',
    });
  });
});