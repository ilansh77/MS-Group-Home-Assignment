import {
  HttpErrorResponse,
} from '@angular/common/http';
import {
  TestBed,
} from '@angular/core/testing';
import {
  firstValueFrom,
  of,
  Subject,
  throwError,
} from 'rxjs';
import {
  GameSessionStatus,
  SlotSymbol,
} from './session.models';
import {
  SessionStoreService,
} from './session-store.service';
import {
  SessionsApiService,
} from './sessions-api.service';

describe('SessionStoreService', () => {
  let store:
    SessionStoreService;

  let sessionsApi:
    jasmine.SpyObj<
      SessionsApiService
    >;

  beforeEach(() => {
    sessionsApi =
      jasmine.createSpyObj<
        SessionsApiService
      >(
        'SessionsApiService',
        [
          'startSession',
          'getCurrentSession',
          'roll',
          'cashOut',
          'clearCurrentSession',
        ],
      );

    TestBed.configureTestingModule({
      providers: [
        SessionStoreService,
        {
          provide:
            SessionsApiService,
          useValue: sessionsApi,
        },
      ],
    });

    store =
      TestBed.inject(
        SessionStoreService,
      );
  });

  it('starts with an empty state', () => {
    expect(
      store.session(),
    ).toBeNull();

    expect(
      store.lastRoll(),
    ).toBeNull();

    expect(
      store.credits(),
    ).toBe(0);

    expect(
      store.pending(),
    ).toBeFalse();

    expect(
      store.canRoll(),
    ).toBeFalse();

    expect(
      store.canCashOut(),
    ).toBeFalse();
  });

  it('sets pending while starting a session', async () => {
    const response$ =
      new Subject<{
        credits: number;
        status:
          GameSessionStatus.Active;
      }>();

    sessionsApi.startSession
      .and.returnValue(
        response$,
      );

    const resultPromise =
      firstValueFrom(
        store.startSession(),
      );

    expect(
      store.pending(),
    ).toBeTrue();

    response$.next({
      credits: 10,
      status:
        GameSessionStatus.Active,
    });

    response$.complete();

    await resultPromise;

    expect(
      store.pending(),
    ).toBeFalse();
  });

  it('stores a newly created session', async () => {
    sessionsApi.startSession
      .and.returnValue(
        of({
          credits: 10,
          status:
            GameSessionStatus.Active,
        }),
      );

    await firstValueFrom(
      store.startSession(),
    );

    expect(
      store.session(),
    ).toEqual({
      credits: 10,
      status:
        GameSessionStatus.Active,
    });

    expect(
      store.credits(),
    ).toBe(10);

    expect(
      store.canRoll(),
    ).toBeTrue();

    expect(
      store.canCashOut(),
    ).toBeTrue();
  });

  it('loads the current session from the server', async () => {
    const session = {
      credits: 25,
      status:
        GameSessionStatus.Active,
      createdAt:
        '2026-07-14T10:00:00.000Z',
      updatedAt:
        '2026-07-14T10:05:00.000Z',
    };

    sessionsApi
      .getCurrentSession
      .and.returnValue(
        of(session),
      );

    const result =
      await firstValueFrom(
        store.loadCurrentSession(
          true,
        ),
      );

    expect(result).toEqual(
      session,
    );

    expect(
      store.session(),
    ).toEqual(session);
  });

  it('uses the cached session when force is false', async () => {
    sessionsApi.startSession
      .and.returnValue(
        of({
          credits: 10,
          status:
            GameSessionStatus.Active,
        }),
      );

    await firstValueFrom(
      store.startSession(),
    );

    sessionsApi
      .getCurrentSession
      .calls.reset();

    const result =
      await firstValueFrom(
        store.loadCurrentSession(),
      );

    expect(result).toEqual({
      credits: 10,
      status:
        GameSessionStatus.Active,
    });

    expect(
      sessionsApi
        .getCurrentSession,
    ).not.toHaveBeenCalled();
  });

  it('clears local state when the current-session endpoint returns 204', async () => {
    sessionsApi.startSession
      .and.returnValue(
        of({
          credits: 10,
          status:
            GameSessionStatus.Active,
        }),
      );

    await firstValueFrom(
      store.startSession(),
    );

    sessionsApi
      .getCurrentSession
      .and.returnValue(
        of(null),
      );

    const result =
      await firstValueFrom(
        store.loadCurrentSession(
          true,
        ),
      );

    expect(result).toBeNull();

    expect(
      store.session(),
    ).toBeNull();

    expect(
      store.lastRoll(),
    ).toBeNull();

    expect(
      store.credits(),
    ).toBe(0);
  });

  it('updates credits and stores the last roll', async () => {
    sessionsApi.startSession
      .and.returnValue(
        of({
          credits: 10,
          status:
            GameSessionStatus.Active,
        }),
      );

    await firstValueFrom(
      store.startSession(),
    );

    const roll = {
      symbols: [
        SlotSymbol.Cherry,
        SlotSymbol.Cherry,
        SlotSymbol.Cherry,
      ] as const,
      won: true,
      reward: 10,
      credits: 19,
    };

    sessionsApi.roll
      .and.returnValue(
        of(roll),
      );

    await firstValueFrom(
      store.roll(),
    );

    expect(
      store.lastRoll(),
    ).toEqual(roll);

    expect(
      store.credits(),
    ).toBe(19);

    expect(
      store.session(),
    ).toEqual({
      credits: 19,
      status:
        GameSessionStatus.Active,
    });
  });

  it('stores the cash-out result', async () => {
    sessionsApi.startSession
      .and.returnValue(
        of({
          credits: 10,
          status:
            GameSessionStatus.Active,
        }),
      );

    await firstValueFrom(
      store.startSession(),
    );

    sessionsApi.cashOut
      .and.returnValue(
        of({
          cashedOutCredits: 10,
          status:
            GameSessionStatus.CashedOut,
        }),
      );

    await firstValueFrom(
      store.cashOut(),
    );

    expect(
      store.session(),
    ).toEqual({
      credits: 0,
      status:
        GameSessionStatus.CashedOut,
      cashedOutCredits: 10,
    });

    expect(
      store.canRoll(),
    ).toBeFalse();

    expect(
      store.canCashOut(),
    ).toBeFalse();
  });

  it('clears local state after deleting the cookie', async () => {
    sessionsApi.startSession
      .and.returnValue(
        of({
          credits: 10,
          status:
            GameSessionStatus.Active,
        }),
      );

    await firstValueFrom(
      store.startSession(),
    );

    sessionsApi
      .clearCurrentSession
      .and.returnValue(
        of(undefined),
      );

    await firstValueFrom(
      store.clearSession(),
    );

    expect(
      store.session(),
    ).toBeNull();

    expect(
      store.lastRoll(),
    ).toBeNull();

    expect(
      store.credits(),
    ).toBe(0);
  });

  it('clears the session when a roll returns 401', async () => {
    sessionsApi.startSession
      .and.returnValue(
        of({
          credits: 10,
          status:
            GameSessionStatus.Active,
        }),
      );

    await firstValueFrom(
      store.startSession(),
    );

    sessionsApi.roll
      .and.returnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 401,
              statusText:
                'Unauthorized',
            }),
        ),
      );

    await expectAsync(
      firstValueFrom(
        store.roll(),
      ),
    ).toBeRejected();

    expect(
      store.session(),
    ).toBeNull();

    expect(
      store.credits(),
    ).toBe(0);
  });

  it('clears the session when a mutation returns 404', async () => {
    sessionsApi.cashOut
      .and.returnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 404,
              statusText:
                'Not Found',
            }),
        ),
      );

    await expectAsync(
      firstValueFrom(
        store.cashOut(),
      ),
    ).toBeRejected();

    expect(
      store.session(),
    ).toBeNull();
  });

  it('stores an error when restoration fails', async () => {
    sessionsApi
      .getCurrentSession
      .and.returnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 503,
              statusText:
                'Service Unavailable',
            }),
        ),
      );

    await expectAsync(
      firstValueFrom(
        store.loadCurrentSession(
          true,
        ),
      ),
    ).toBeRejected();

    expect(
      store.error(),
    ).not.toBeNull();

    expect(
      store.pending(),
    ).toBeFalse();
  });
});