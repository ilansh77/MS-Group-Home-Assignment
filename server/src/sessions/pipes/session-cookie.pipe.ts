import {
  Injectable,
  PipeTransform,
  UnauthorizedException,
} from '@nestjs/common';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class SessionCookiePipe
  implements PipeTransform<unknown, string>
{
  transform(value: unknown): string {
    if (
      typeof value !== 'string' ||
      value.length === 0
    ) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'SESSION_COOKIE_MISSING',
        message:
          'A game session cookie is required.',
      });
    }

    if (!UUID_V4_PATTERN.test(value)) {
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