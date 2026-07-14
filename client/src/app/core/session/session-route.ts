import {
  GameSessionStatus,
} from './session.models';

export type SessionRoute =
  | '/game'
  | '/cashout';

export function getSessionRoute(
  status: GameSessionStatus,
): SessionRoute {
  switch (status) {
    case GameSessionStatus.Active:
      return '/game';

    case GameSessionStatus.CashedOut:
      return '/cashout';
  }
}