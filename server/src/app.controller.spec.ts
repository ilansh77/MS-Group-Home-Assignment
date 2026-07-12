import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const testingModule: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = testingModule.get<AppController>(AppController);
  });

  describe('getAlive', () => {
    it('returns the service liveness status', () => {
      expect(appController.getAlive()).toEqual({
        status: 'ok',
        service: 'casino-jackpot-api',
      });
    });
  });
});