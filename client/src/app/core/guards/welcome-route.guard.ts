import {
  inject,
} from '@angular/core';
import {
  Router,
  type CanActivateFn,
} from '@angular/router';
import {
  catchError,
  map,
  of,
} from 'rxjs';
import {
  getSessionRoute,
} from '../session/session-route';
import {
  SessionStoreService,
} from '../session/session-store.service';

export const welcomeRouteGuard:
  CanActivateFn = () => {
    const router =
      inject(Router);

    const sessionStore =
      inject(SessionStoreService);

    return sessionStore
      .loadCurrentSession(true)
      .pipe(
        map((session) => {
          if (!session) {
            return true;
          }

          return router.parseUrl(
            getSessionRoute(
              session.status,
            ),
          );
        }),
        catchError(() => {
          return of(true);
        }),
      );
  };