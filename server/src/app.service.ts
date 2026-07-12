import { Injectable } from '@nestjs/common';

export interface AliveResponse {
  status: 'ok';
  service: string;
}

@Injectable()
export class AppService {
  getAlive(): AliveResponse {
    return {
      status: 'ok',
      service: 'casino-jackpot-api',
    };
  }
}
