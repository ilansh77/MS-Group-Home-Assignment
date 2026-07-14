import type {
  Routes,
} from '@angular/router';
import {
  EXPECTED_SESSION_STATUS,
  sessionStatusGuard,
} from './core/guards/session-status.guard';
import {
  welcomeRouteGuard,
} from './core/guards/welcome-route.guard';
import {
  GameSessionStatus,
} from './core/session/session.models';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Casino Jackpot',
    canActivate: [
      welcomeRouteGuard,
    ],
    loadComponent: () =>
      import(
        './features/welcome/pages/welcome-page/welcome-page.component'
      ).then(
        (module) =>
          module.WelcomePageComponent,
      ),
  },
  {
    path: 'game',
    title:
      'Casino Jackpot - Game',
    canActivate: [
      sessionStatusGuard,
    ],
    data: {
      [EXPECTED_SESSION_STATUS]:
        GameSessionStatus.Active,
    },
    loadComponent: () =>
      import(
        './features/game/pages/game-page/game-page.component'
      ).then(
        (module) =>
          module.GamePageComponent,
      ),
  },
  {
    path: 'cashout',
    title:
      'Casino Jackpot - Cash Out',
    canActivate: [
      sessionStatusGuard,
    ],
    data: {
      [EXPECTED_SESSION_STATUS]:
        GameSessionStatus.CashedOut,
    },
    loadComponent: () =>
      import(
        './features/cashout/pages/cashout-page/cashout-page.component'
      ).then(
        (module) =>
          module.CashoutPageComponent,
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];