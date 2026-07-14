import {
  PipeTransform,
  UnauthorizedException,
} from '@nestjs/common';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class SessionCookiePipe
  implements PipeTransform<unknown, string | null>
{
  constructor(
    private readonly optional = false,
  ) {}

  transform(value: unknown): string | null {
    const isMissing =
      value === undefined ||
      value === null ||
      value === '';

    if (isMissing) {
      if (this.optional) {
        return null;
      }

      throw new UnauthorizedException({
        statusCode: 401,
        code: 'SESSION_COOKIE_MISSING',
        message:
          'A game session cookie is required.',
      });
    }

    if (
      typeof value !== 'string' ||
      !UUID_V4_PATTERN.test(value)
    ) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'INVALID_SESSION_COOKIE',
        message:
          'The game session cookie is invalid.',
      });
    }

    return value;
  }
}

export const REQUIRED_SESSION_COOKIE_PIPE =
  new SessionCookiePipe(false);

export const OPTIONAL_SESSION_COOKIE_PIPE =
  new SessionCookiePipe(true);