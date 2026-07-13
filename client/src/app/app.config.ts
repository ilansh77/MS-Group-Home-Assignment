import {
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import type {
  ApplicationConfig,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { credentialsInterceptor } from './core/http/credentials.interceptor';
import { API_BASE_URL } from './core/http/api-client.service';
import { environment } from '../environments/environment.development';

export const appConfig:
  ApplicationConfig = {
    providers: [
      provideRouter(routes),
      provideHttpClient(
        withInterceptors([
          credentialsInterceptor,
        ]),
      ),
      {
        provide: API_BASE_URL,
        useValue: environment.apiBaseUrl,
      },
    ],
  };