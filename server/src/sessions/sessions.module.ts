import { Module } from '@nestjs/common';
import { GameModule } from '../game/game.module';
import { RedisModule } from '../redis/redis.module';
import { RedisSessionRepository } from './redis-session.repository';
import { SessionRepository } from './session.repository';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SessionCookiePipe } from './pipes/session-cookie.pipe';
import { SessionCookieOptionsService } from './session-cookie-options.service';

@Module({
  imports: [
    RedisModule,
    GameModule,
  ],
  controllers: [SessionsController],
  providers: [
    SessionsService,
    RedisSessionRepository,
    SessionCookieOptionsService,
    {
      provide: SessionRepository,
      useExisting: RedisSessionRepository,
    },
  ],
})
export class SessionsModule {}