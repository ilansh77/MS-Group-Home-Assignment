import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

@Injectable()
export class RedisService implements OnModuleInit {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.getOrThrow<string>('UPSTASH_REDIS_REST_URL');

    const token = this.configService.getOrThrow<string>(
      'UPSTASH_REDIS_REST_TOKEN',
    );

    this.client = new Redis({
      url,
      token,
      enableTelemetry: false,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ping();
      this.logger.log('Redis connection verified');
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown Redis error';

      this.logger.error(`Redis initialization failed: ${message}`);

      throw error;
    }
  }

  async ping(): Promise<void> {
    const response = await this.client.ping();

    if (response !== 'PONG') {
      throw new Error(`Unexpected Redis PING response: ${String(response)}`);
    }
  }

  getClient(): Redis {
    return this.client;
  }
}
