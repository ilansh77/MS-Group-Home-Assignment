import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClientService } from '../http/api-client.service';
import type {
  CashOutSessionResponse,
  RollSessionResponse,
  SessionState,
} from './session.models';

@Injectable({
  providedIn: 'root',
})
export class SessionsApiService {
  private readonly api =
    inject(ApiClientService);

  startSession():
    Observable<SessionState> {
    return this.api.post<SessionState>(
      '/sessions',
    );
  }

  getCurrentSession():
    Observable<SessionState> {
    return this.api.get<SessionState>(
      '/sessions/current',
    );
  }

  roll():
    Observable<RollSessionResponse> {
    return this.api.post<RollSessionResponse>(
      '/sessions/current/roll',
    );
  }

  cashOut():
    Observable<CashOutSessionResponse> {
    return this.api.post<CashOutSessionResponse>(
      '/sessions/current/cash-out',
    );
  }
}