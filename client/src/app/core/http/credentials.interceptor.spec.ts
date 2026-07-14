import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  TestBed,
} from '@angular/core/testing';
import {
  credentialsInterceptor,
} from './credentials.interceptor';

describe(
  'credentialsInterceptor',
  () => {
    let httpClient: HttpClient;
    let httpTesting:
      HttpTestingController;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(
            withInterceptors([
              credentialsInterceptor,
            ]),
          ),
          provideHttpClientTesting(),
        ],
      });

      httpClient =
        TestBed.inject(HttpClient);

      httpTesting =
        TestBed.inject(
          HttpTestingController,
        );
    });

    afterEach(() => {
      httpTesting.verify();
    });

    it('adds credentials to outgoing requests', () => {
      httpClient
        .get('/api/test')
        .subscribe();

      const request =
        httpTesting.expectOne(
          '/api/test',
        );

      expect(
        request.request
          .withCredentials,
      ).toBeTrue();

      request.flush({
        status: 'ok',
      });
    });
  },
);