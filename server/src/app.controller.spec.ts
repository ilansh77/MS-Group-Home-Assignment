import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisService } from './redis/redis.service';

describe('AppController', () => {
  let appController: AppController;

  const redisServiceMock = {
    ping: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    redisServiceMock.ping.mockResolvedValue(undefined);

    const testingModule: TestingModule =
      await Test.createTestingModule({
        controllers: [AppController],
        providers: [
          AppService,
          {
            provide: RedisService,
            useValue: redisServiceMock,
          },
        ],
      }).compile();

    appController =
      testingModule.get<AppController>(AppController);
  });

  describe('getAlive', () => {
    it('returns the API and Redis health status', async () => {
      await expect(appController.getAlive()).resolves.toEqual({
        status: 'ok',
        redis: 'connected',
        service: 'casino-jackpot-api',
      });

      expect(redisServiceMock.ping).toHaveBeenCalledTimes(1);
    });
  });
});