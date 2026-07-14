import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { SessionsService } from './sessions.service';
import { SessionCookieOptionsService } from './session-cookie-options.service';
import { Cookie } from '../common/http/decorators/cookie.decorator';
import { GetSessionResponseDto } from './dto/get-session-response.dto';
import {
  OPTIONAL_SESSION_COOKIE_PIPE,
  REQUIRED_SESSION_COOKIE_PIPE,
} from './pipes/session-cookie.pipe';

@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessionsService:
      SessionsService,
    private readonly cookieOptions:
      SessionCookieOptionsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSession(
    @Res({ passthrough: true })
    response: Response,
  ) {
    const session =
      await this.sessionsService.createSession();

    response.cookie(
      SessionCookieOptionsService.COOKIE_NAME,
      session.sessionId,
      this.cookieOptions.getSessionCookieOptions(
        true,
      ),
    );

    return {
      credits: session.credits,
      status: session.status,
    };
  }

@Get('current')
async getCurrentSession(
  @Cookie(
    SessionCookieOptionsService.COOKIE_NAME,
    OPTIONAL_SESSION_COOKIE_PIPE,
  )
  sessionId: string | null,
  @Res({ passthrough: true })
  response: Response,
): Promise<GetSessionResponseDto | undefined> {
  if (!sessionId) {
    response.status(HttpStatus.NO_CONTENT);

    return undefined;
  }

  try {
    return await this.sessionsService.getSession(
      sessionId,
    );
  } catch (error: unknown) {
    if (
      error instanceof NotFoundException
    ) {
      response.clearCookie(
        SessionCookieOptionsService.COOKIE_NAME,
        this.cookieOptions
          .getSessionCookieOptions(false),
      );

      response.status(
        HttpStatus.NO_CONTENT,
      );

      return undefined;
    }

    throw error;
  }
}

  @Post('current/roll')
  @HttpCode(HttpStatus.OK)
  rollCurrentSession(
    @Cookie(
      SessionCookieOptionsService.COOKIE_NAME,
      REQUIRED_SESSION_COOKIE_PIPE
    )
    sessionId: string,
  ) {
    return this.sessionsService.rollSession(
      sessionId,
    );
  }

  @Post('current/cash-out')
  @HttpCode(HttpStatus.OK)
  cashOutCurrentSession(
    @Cookie(
      SessionCookieOptionsService.COOKIE_NAME,
      REQUIRED_SESSION_COOKIE_PIPE,
    )
    sessionId: string,
  ) {
    return this.sessionsService.cashOutSession(
      sessionId,
    );
  }

  @Delete('current')
  @HttpCode(HttpStatus.NO_CONTENT)
  clearCurrentSession(
    @Res({ passthrough: true })
    response: Response,
  ): void {
    response.clearCookie(
      SessionCookieOptionsService.COOKIE_NAME,
      this.cookieOptions.getSessionCookieOptions(
        false,
      ),
    );
  }
}