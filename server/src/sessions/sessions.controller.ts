import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CookieOptions,
  Response,
} from 'express';
import { CashOutSessionResponseDto } from './dto/cash-out-session-response.dto';
import { CreateSessionResponseDto } from './dto/create-session-response.dto';
import { GetSessionResponseDto } from './dto/get-session-response.dto';
import { RollSessionResponseDto } from './dto/roll-session-response.dto';
import { SessionCookiePipe } from './pipes/session-cookie.pipe';
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_PATH,
} from './session-cookie.constants';
import { SessionsService } from './sessions.service';
import { Cookie } from './../common/http/decorators/cookie.decorator';

const DEFAULT_SESSION_TTL_SECONDS =
  86_400;

@Controller('sessions')
export class SessionsController {
  private readonly cookieOptions:
    CookieOptions;

  constructor(
    private readonly sessionsService:
      SessionsService,
    private readonly configService:
      ConfigService,
  ) {
    this.cookieOptions =
      this.buildCookieOptions();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSession(
    @Res({ passthrough: true })
    response: Response,
  ): Promise<CreateSessionResponseDto> {
    const createdSession =
      await this.sessionsService.createSession();

    response.cookie(
      SESSION_COOKIE_NAME,
      createdSession.sessionId,
      this.cookieOptions,
    );

    return {
      credits: createdSession.credits,
      status: createdSession.status,
    };
  }

  @Get('current')
  getCurrentSession(
    @Cookie(
      SESSION_COOKIE_NAME,
      SessionCookiePipe,
    )
    sessionId: string,
  ): Promise<GetSessionResponseDto> {
    return this.sessionsService.getSession(
      sessionId,
    );
  }

  @Post('current/roll')
  @HttpCode(HttpStatus.OK)
  rollCurrentSession(
    @Cookie(
      SESSION_COOKIE_NAME,
      SessionCookiePipe,
    )
    sessionId: string,
  ): Promise<RollSessionResponseDto> {
    return this.sessionsService.rollSession(sessionId);
  }

  @Post('current/cash-out')
  @HttpCode(HttpStatus.OK)
  cashOutCurrentSession(
    @Cookie(
      SESSION_COOKIE_NAME,
      SessionCookiePipe,
    )
    sessionId: string,
  ): Promise<CashOutSessionResponseDto> {
    return this.sessionsService.cashOutSession(sessionId);
  }

  private buildCookieOptions():
    CookieOptions {
    const configuredTtl =
      this.configService.get<string>(
        'SESSION_TTL_SECONDS',
      );

    const ttlSeconds = configuredTtl
      ? Number(configuredTtl)
      : DEFAULT_SESSION_TTL_SECONDS;

    if (
      !Number.isInteger(ttlSeconds) ||
      ttlSeconds <= 0
    ) {
      throw new Error(
        `Invalid SESSION_TTL_SECONDS configuration: ${configuredTtl}`,
      );
    }

    const isProduction =
      this.configService.get<string>(
        'NODE_ENV',
      ) === 'production';

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: SESSION_COOKIE_PATH,
      maxAge: ttlSeconds * 1_000,
    };
  }
}