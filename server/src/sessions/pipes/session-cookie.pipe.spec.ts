import { SessionCookiePipe } from './session-cookie.pipe';

describe('SessionCookiePipe', () => {
  const sessionId =
    'faae3a7b-9726-4819-a7fa-64ac0cd5ae37';

  describe('required mode', () => {
    const pipe =
      new SessionCookiePipe(false);

    it('returns a valid UUID', () => {
      expect(
        pipe.transform(sessionId),
      ).toBe(sessionId);
    });

    it('rejects a missing cookie', () => {
      expect(() =>
        pipe.transform(undefined),
      ).toThrow(
        expect.objectContaining({
          response:
            expect.objectContaining({
              code:
                'SESSION_COOKIE_MISSING',
            }),
        }),
      );
    });

    it('rejects an invalid cookie', () => {
      expect(() =>
        pipe.transform('invalid'),
      ).toThrow(
        expect.objectContaining({
          response:
            expect.objectContaining({
              code:
                'INVALID_SESSION_COOKIE',
            }),
        }),
      );
    });
  });

  describe('optional mode', () => {
    const pipe =
      new SessionCookiePipe(true);

    it('returns null for a missing cookie', () => {
      expect(
        pipe.transform(undefined),
      ).toBeNull();

      expect(
        pipe.transform(null),
      ).toBeNull();

      expect(
        pipe.transform(''),
      ).toBeNull();
    });

    it('returns a valid UUID', () => {
      expect(
        pipe.transform(sessionId),
      ).toBe(sessionId);
    });

    it('still rejects malformed cookies', () => {
      expect(() =>
        pipe.transform('invalid'),
      ).toThrow(
        expect.objectContaining({
          response:
            expect.objectContaining({
              code:
                'INVALID_SESSION_COOKIE',
            }),
        }),
      );
    });
  });
});