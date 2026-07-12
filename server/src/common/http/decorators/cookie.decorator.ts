import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

export const Cookie = createParamDecorator(
  (
    cookieName: string,
    context: ExecutionContext,
  ): unknown => {
    const request =
      context.switchToHttp().getRequest<Request>();

    const cookies =
      request.cookies as
        | Record<string, unknown>
        | undefined;

    return cookies?.[cookieName];
  },
);