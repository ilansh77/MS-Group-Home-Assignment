import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { SessionRepository } from './session.repository';
import { RedisSessionRepository } from './redis-session.repository';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [RedisModule],
  controllers: [SessionsController],
  providers: [
    SessionsService,
    {
      provide: SessionRepository,
      useClass: RedisSessionRepository,
    },
  ],
})
export class SessionsModule {}
