import { TestBed } from '@angular/core/testing';

import { SessionsApiService } from './sessions-api.service';

describe('SessionsApiService', () => {
  let service: SessionsApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SessionsApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
