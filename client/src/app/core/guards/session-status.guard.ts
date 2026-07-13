import { inject } from '@angular/core';
import {
  Router,
  type CanActivateFn,
} from '@angular/router';
import {
  catchError,
  map,
  of,
} from 'rxjs';
import { GameSessionStatus } from '../session/session.models';
import { SessionStoreService } from '../session/session-store.service';

export const EXPECTED_SESSION_STATUS =
  'expectedSessionStatus';

export const sessionStatusGuard:
  CanActivateFn = (route) => {
    const router = inject(Router);
    const sessionStore =
      inject(SessionStoreService);

    const expectedStatus =
      route.data[
        EXPECTED_SESSION_STATUS
      ] as GameSessionStatus;

    return sessionStore
      .loadCurrentSession()
      .pipe(
        map((session) => {
          if (
            session.status ===
            expectedStatus
          ) {
            return true;
          }

          return router.createUrlTree([
            '/',
          ]);
        }),
        catchError(() =>
          of(
            router.createUrlTree([
              '/',
            ]),
          ),
        ),
      );
  };