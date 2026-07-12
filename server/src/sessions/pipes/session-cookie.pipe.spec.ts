import { UnauthorizedException } from '@nestjs/common';
import { SessionCookiePipe } from './session-cookie.pipe';

describe('SessionCookiePipe', () => {
  let pipe: SessionCookiePipe;

  beforeEach(() => {
    pipe = new SessionCookiePipe();
  });

  it('returns a valid UUID v4', () => {
    const sessionId =
      'faae3a7b-9726-4819-a7fa-64ac0cd5ae37';

    expect(pipe.transform(sessionId)).toBe(
      sessionId,
    );
  });

  it('rejects a missing cookie', () => {
    expect(() =>
      pipe.transform(undefined),
    ).toThrow(UnauthorizedException);
  });

  it('rejects an empty cookie', () => {
    expect(() =>
      pipe.transform(''),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a non-string cookie', () => {
    expect(() =>
      pipe.transform(123),
    ).toThrow(UnauthorizedException);
  });

  it('rejects an invalid UUID', () => {
    expect(() =>
      pipe.transform('invalid-session-id'),
    ).toThrow(UnauthorizedException);
  });

  it('returns SESSION_COOKIE_MISSING for a missing value', () => {
    try {
      pipe.transform(undefined);

      fail('Expected the pipe to throw');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(
        UnauthorizedException,
      );

      expect(
        (
          error as UnauthorizedException
        ).getResponse(),
      ).toMatchObject({
        code: 'SESSION_COOKIE_MISSING',
      });
    }
  });

  it('returns INVALID_SESSION_COOKIE for a malformed value', () => {
    try {
      pipe.transform('not-a-uuid');

      fail('Expected the pipe to throw');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(
        UnauthorizedException,
      );

      expect(
        (
          error as UnauthorizedException
        ).getResponse(),
      ).toMatchObject({
        code: 'INVALID_SESSION_COOKIE',
      });
    }
  });
});