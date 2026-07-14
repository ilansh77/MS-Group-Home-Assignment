import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';

const DEFAULT_SESSION_TTL_SECONDS =
  86_400;

@Injectable()
export class SessionCookieOptionsService {
  static readonly COOKIE_NAME =
    'casino_session';

  static readonly COOKIE_PATH =
    '/api/sessions';

  constructor(
    private readonly configService:
      ConfigService,
  ) {}

  getSessionCookieOptions(
    includeLifetime: boolean,
  ): CookieOptions {
    const options: CookieOptions = {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: 'lax',
      path:
        SessionCookieOptionsService
          .COOKIE_PATH,
    };

    if (!includeLifetime) {
      return options;
    }

    return {
      ...options,
      maxAge: this.getTtlMilliseconds(),
    };
  }

  private isProduction(): boolean {
    return (
      this.configService.get<string>(
        'NODE_ENV',
      ) === 'production'
    );
  }

  private getTtlMilliseconds(): number {
    const configuredTtl =
      this.configService.get<string>(
        'SESSION_TTL_SECONDS',
      ) ??
      String(
        DEFAULT_SESSION_TTL_SECONDS,
      );

    const ttlSeconds =
      Number(configuredTtl);

    if (
      !Number.isInteger(ttlSeconds) ||
      ttlSeconds <= 0
    ) {
      throw new Error(
        `Invalid SESSION_TTL_SECONDS configuration: ${configuredTtl}`,
      );
    }

    return ttlSeconds * 1_000;
  }
}