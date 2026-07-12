import { Module } from '@nestjs/common';
import { CryptoRandomSource } from './crypto-random-source';
import { GameEngineService } from './game-engine.service';
import { RandomSource } from './random-source';

@Module({
  providers: [
    GameEngineService,
    CryptoRandomSource,
    {
      provide: RandomSource,
      useExisting: CryptoRandomSource,
    },
  ],
  exports: [GameEngineService],
})
export class GameModule {}