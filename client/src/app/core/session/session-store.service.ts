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
import { SessionsApiService } from './sessions-api.service';
import {
  GameSessionStatus,
  type CashOutSessionResponse,
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
    signal<SessionState | null>(null);

  private readonly pendingState =
    signal(false);

  private readonly errorState =
    signal<string | null>(null);

  private readonly lastRollState =
    signal<RollSessionResponse | null>(
      null,
    );

  readonly session =
    this.sessionState.asReadonly();

  readonly pending =
    this.pendingState.asReadonly();

  readonly error =
    this.errorState.asReadonly();

  readonly lastRoll =
    this.lastRollState.asReadonly();

  readonly credits = computed(
    () =>
      this.sessionState()?.credits ?? 0,
  );

  readonly canRoll = computed(() => {
    const session =
      this.sessionState();

    return (
      session?.status ===
        GameSessionStatus.Active &&
      session.credits > 0 &&
      !this.pendingState()
    );
  });

  startSession():
    Observable<SessionState> {
    return this.executeRequest(
      () =>
        this.sessionsApi.startSession(),
      'Unable to start a game session.',
      (session) => {
        this.sessionState.set(session);
        this.lastRollState.set(null);
      },
    );
  }

  loadCurrentSession(
    force = false,
  ): Observable<SessionState> {
    const cached =
      this.sessionState();

    if (cached && !force) {
      return of(cached);
    }

    return this.executeRequest(
      () =>
        this.sessionsApi.getCurrentSession(),
      'Unable to restore the game session.',
      (session) => {
        this.sessionState.set(session);
      },
      () => {
        this.sessionState.set(null);
      },
    );
  }

  roll():
    Observable<RollSessionResponse> {
    return this.executeRequest(
      () => this.sessionsApi.roll(),
      'Unable to complete the roll.',
      (result) => {
        this.lastRollState.set(result);

        this.sessionState.update(
          (current) =>
            current
              ? {
                  ...current,
                  credits:
                    result.credits,
                }
              : current,
        );
      },
    );
  }

  cashOut():
    Observable<CashOutSessionResponse> {
    return this.executeRequest(
      () =>
        this.sessionsApi.cashOut(),
      'Unable to cash out the session.',
      (result) => {
        this.sessionState.update(
          (current) =>
            current
              ? {
                  ...current,
                  credits: 0,
                  status:
                    GameSessionStatus.CashedOut,
                  cashedOutCredits:
                    result.cashedOutCredits,
                }
              : current,
        );
      },
    );
  }

  clear(): void {
    this.sessionState.set(null);
    this.lastRollState.set(null);
    this.errorState.set(null);
  }

  private executeRequest<T>(
    requestFactory:
      () => Observable<T>,
    errorMessage: string,
    onSuccess: (value: T) => void,
    onFailure?: () => void,
  ): Observable<T> {
    return defer(() => {
      this.pendingState.set(true);
      this.errorState.set(null);

      return requestFactory().pipe(
        tap(onSuccess),
        catchError((error: unknown) => {
          this.errorState.set(
            errorMessage,
          );

          onFailure?.();

          return throwError(
            () => error,
          );
        }),
        finalize(() => {
          this.pendingState.set(false);
        }),
      );
    });
  }
}