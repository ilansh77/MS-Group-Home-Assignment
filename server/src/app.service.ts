import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { RedisService } from './redis/redis.service';

export interface AliveResponse {
  status: 'ok';
  redis: 'connected';
  service: string;
}

@Injectable()
export class AppService {
  constructor(private readonly redisService: RedisService) {}

  async getAlive(): Promise<AliveResponse> {
    try {
      await this.redisService.ping();

      return {
        status: 'ok',
        redis: 'connected',
        service: 'casino-jackpot-api',
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        redis: 'disconnected',
        service: 'casino-jackpot-api',
      });
    }
  }
}
