import {
  TestBed,
} from '@angular/core/testing';
import {
  firstValueFrom,
  of,
} from 'rxjs';
import {
  ApiClientService,
} from '../http/api-client.service';
import {
  GameSessionStatus,
  SlotSymbol,
} from './session.models';
import {
  SessionsApiService,
} from './sessions-api.service';

describe('SessionsApiService', () => {
  let service:
    SessionsApiService;

  let apiClient:
    jasmine.SpyObj<ApiClientService>;

  beforeEach(() => {
    apiClient =
      jasmine.createSpyObj<
        ApiClientService
      >(
        'ApiClientService',
        [
          'get',
          'post',
          'delete',
        ],
      );

    TestBed.configureTestingModule({
      providers: [
        SessionsApiService,
        {
          provide:
            ApiClientService,
          useValue: apiClient,
        },
      ],
    });

    service =
      TestBed.inject(
        SessionsApiService,
      );
  });

  it('creates a session', async () => {
    const response = {
      credits: 10,
      status:
        GameSessionStatus.Active,
    };

    apiClient.post
      .and.returnValue(
        of(response),
      );

    const result =
      await firstValueFrom(
        service.startSession(),
      );

    expect(result).toEqual(
      response,
    );

    expect(
      apiClient.post,
    ).toHaveBeenCalledTimes(1);

    expect(
      apiClient.post,
    ).toHaveBeenCalledWith(
      '/sessions',
    );
  });

  it('retrieves the current session', async () => {
    const response = {
      credits: 10,
      status:
        GameSessionStatus.Active,
      createdAt:
        '2026-07-14T10:00:00.000Z',
      updatedAt:
        '2026-07-14T10:00:00.000Z',
    };

    apiClient.get
      .and.returnValue(
        of(response),
      );

    const result =
      await firstValueFrom(
        service.getCurrentSession(),
      );

    expect(result).toEqual(
      response,
    );

    expect(
      apiClient.get,
    ).toHaveBeenCalledWith(
      '/sessions/current',
    );
  });

  it('returns null when the server responds with no current session', async () => {
    apiClient.get
      .and.returnValue(
        of(null),
      );

    const result =
      await firstValueFrom(
        service.getCurrentSession(),
      );

    expect(result).toBeNull();
  });

  it('rolls the current session', async () => {
    const response = {
      symbols: [
        SlotSymbol.Cherry,
        SlotSymbol.Cherry,
        SlotSymbol.Cherry,
      ] as const,
      won: true,
      reward: 10,
      credits: 19,
    };

    apiClient.post
      .and.returnValue(
        of(response),
      );

    const result =
      await firstValueFrom(
        service.roll(),
      );

    expect(result).toEqual(
      response,
    );

    expect(
      apiClient.post,
    ).toHaveBeenCalledWith(
      '/sessions/current/roll',
    );
  });

  it('cashes out the current session', async () => {
    const response = {
      cashedOutCredits: 19,
      status:
        GameSessionStatus.CashedOut,
    };

    apiClient.post
      .and.returnValue(
        of(response),
      );

    const result =
      await firstValueFrom(
        service.cashOut(),
      );

    expect(result).toEqual(
      response as any,
    );

    expect(
      apiClient.post,
    ).toHaveBeenCalledWith(
      '/sessions/current/cash-out',
    );
  });

  it('clears the current session cookie', async () => {
    apiClient.delete
      .and.returnValue(
        of(undefined),
      );

    await firstValueFrom(
      service.clearCurrentSession(),
    );

    expect(
      apiClient.delete,
    ).toHaveBeenCalledWith(
      '/sessions/current',
    );
  });
});