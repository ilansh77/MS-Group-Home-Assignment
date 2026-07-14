import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { InjectionToken } from '@angular/core';

export const API_BASE_URL = new InjectionToken<string>(
  'API_BASE_URL',
);

@Injectable({
  providedIn: 'root',
})
export class ApiClientService {
  private readonly http =
    inject(HttpClient);

  private readonly baseUrl =
    inject(API_BASE_URL);

  get<TResponse>(
    path: string,
  ): Observable<TResponse> {
    return this.http.get<TResponse>(
      this.buildUrl(path),
    );
  }

  post<
    TResponse,
    TRequest = undefined,
  >(
    path: string,
    body?: TRequest,
  ): Observable<TResponse> {
    return this.http.post<TResponse>(
      this.buildUrl(path),
      body ?? null,
    );
  }

  delete<TResponse = void>(
    path: string,
  ): Observable<TResponse> {
    return this.http.delete<TResponse>(
      this.buildUrl(path),
    );
  }

  private buildUrl(path: string): string {
    return `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
  }
}