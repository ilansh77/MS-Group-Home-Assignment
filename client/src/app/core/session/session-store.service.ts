import {
  HttpErrorResponse,
} from '@angular/common/http';
import {
  computed,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import {
  catchError,
  defer,
  finalize,
  Observable,
  of,
  tap,
  throwError,
} from 'rxjs';
import {
  SessionsApiService,
} from './sessions-api.service';
import {
  GameSessionStatus,
  type CashOutSessionResponse,
  type CreateSessionResponse,
  type RollSessionResponse,
  type SessionState,
} from './session.models';

@Injectable({
  providedIn: 'root',
})
export class SessionStoreService {
  private readonly sessionsApi =
    inject(SessionsApiService);

  private readonly sessionState =
    signal<SessionState | null>(
      null,
    );

  private readonly lastRollState =
    signal<RollSessionResponse | null>(
      null,
    );

  private readonly errorState =
    signal<string | null>(
      null,
    );

  private readonly activeRequestCountState =
    signal(0);

  readonly session =
    this.sessionState.asReadonly();

  readonly lastRoll =
    this.lastRollState.asReadonly();

  readonly error =
    this.errorState.asReadonly();

  readonly pending = computed(
    () =>
      this.activeRequestCountState() >
      0,
  );

  readonly credits = computed(
    () =>
      this.sessionState()?.credits ??
      0,
  );

  readonly canRoll = computed(() => {
    const session =
      this.sessionState();

    return (
      session?.status ===
        GameSessionStatus.Active &&
      session.credits > 0 &&
      !this.pending()
    );
  });

  readonly canCashOut =
    computed(() => {
      return (
        this.sessionState()
          ?.status ===
          GameSessionStatus.Active &&
        !this.pending()
      );
    });

  startSession():
    Observable<CreateSessionResponse> {
    return defer(() => {
      this.beginRequest();

      return this.sessionsApi
        .startSession()
        .pipe(
          tap((session) => {
            this.sessionState.set({
              credits:
                session.credits,
              status:
                session.status,
            });

            this.lastRollState.set(
              null,
            );
          }),
          catchError(
            (error: unknown) => {
              this.errorState.set(
                'Unable to start a new game session.',
              );

              return throwError(
                () => error,
              );
            },
          ),
          finalize(() => {
            this.endRequest();
          }),
        );
    });
  }

  loadCurrentSession(
    force = false,
  ): Observable<
    SessionState | null
  > {
    const currentSession =
      this.sessionState();

    if (
      currentSession &&
      !force
    ) {
      return of(currentSession);
    }

    return defer(() => {
      this.beginRequest();

      return this.sessionsApi
        .getCurrentSession()
        .pipe(
          tap((session) => {
            this.sessionState.set(
              session,
            );
          }),
          catchError(
            (error: unknown) => {
              if (
                this.isSessionUnavailable(
                  error,
                )
              ) {
                this.clearLocalState();

                return of(null);
              }

              this.errorState.set(
                'Unable to restore the current session.',
              );

              return throwError(
                () => error,
              );
            },
          ),
          finalize(() => {
            this.endRequest();
          }),
        );
    });
  }

  roll():
    Observable<RollSessionResponse> {
    return defer(() => {
      this.beginRequest();

      return this.sessionsApi
        .roll()
        .pipe(
          tap((result) => {
            this.lastRollState.set(
              result,
            );

            this.sessionState.update(
              (current) => {
                if (!current) {
                  return current;
                }

                return {
                  ...current,
                  credits:
                    result.credits,
                };
              },
            );
          }),
          catchError(
            (error: unknown) =>
              this.handleMutationError(
                error,
                'Unable to complete the roll.',
              ),
          ),
          finalize(() => {
            this.endRequest();
          }),
        );
    });
  }

  cashOut():
    Observable<CashOutSessionResponse> {
    return defer(() => {
      this.beginRequest();

      return this.sessionsApi
        .cashOut()
        .pipe(
          tap((result) => {
            this.sessionState.update(
              (current) => {
                if (!current) {
                  return current;
                }

                return {
                  ...current,
                  credits: 0,
                  status:
                    GameSessionStatus.CashedOut,
                  cashedOutCredits:
                    result
                      .cashedOutCredits,
                };
              },
            );
          }),
          catchError(
            (error: unknown) =>
              this.handleMutationError(
                error,
                'Unable to cash out the current session.',
              ),
          ),
          finalize(() => {
            this.endRequest();
          }),
        );
    });
  }

  clearSession():
    Observable<void> {
    return defer(() => {
      this.beginRequest();

      return this.sessionsApi
        .clearCurrentSession()
        .pipe(
          tap(() => {
            this.clearLocalState();
          }),
          catchError(
            (error: unknown) => {
              this.errorState.set(
                'Unable to clear the current session.',
              );

              return throwError(
                () => error,
              );
            },
          ),
          finalize(() => {
            this.endRequest();
          }),
        );
    });
  }

  private handleMutationError(
    error: unknown,
    message: string,
  ): Observable<never> {
    if (
      this.isSessionUnavailable(
        error,
      )
    ) {
      this.clearLocalState();
    } else {
      this.errorState.set(
        message,
      );
    }

    return throwError(
      () => error,
    );
  }

  private isSessionUnavailable(
    error: unknown,
  ): boolean {
    return (
      error instanceof
        HttpErrorResponse &&
      (
        error.status === 401 ||
        error.status === 404
      )
    );
  }

  private beginRequest(): void {
    this.errorState.set(null);

    this.activeRequestCountState
      .update(
        (count) => count + 1,
      );
  }

  private endRequest(): void {
    this.activeRequestCountState
      .update(
        (count) =>
          Math.max(0, count - 1),
      );
  }

  private clearLocalState(): void {
    this.sessionState.set(null);
    this.lastRollState.set(null);
    this.errorState.set(null);
  }
}