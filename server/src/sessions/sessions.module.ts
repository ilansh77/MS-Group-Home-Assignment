import { Module } from '@nestjs/common';
import { GameModule } from '../game/game.module';
import { RedisModule } from '../redis/redis.module';
import { RedisSessionRepository } from './redis-session.repository';
import { SessionRepository } from './session.repository';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SessionCookiePipe } from './pipes/session-cookie.pipe';

@Module({
  imports: [
    RedisModule,
    GameModule,
  ],
  controllers: [SessionsController],
  providers: [
    SessionsService,
    RedisSessionRepository,
    SessionCookiePipe,
    {
      provide: SessionRepository,
      useExisting: RedisSessionRepository,
    },
  ],
})
export class SessionsModule {}