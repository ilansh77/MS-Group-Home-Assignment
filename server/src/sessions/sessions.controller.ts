import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CashOutSessionResponseDto } from './dto/cash-out-session-response.dto';
import { CreateSessionResponseDto } from './dto/create-session-response.dto';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createSession(): Promise<CreateSessionResponseDto> {
    return this.sessionsService.createSession();
  }

  @Post(':sessionId/cash-out')
  @HttpCode(HttpStatus.OK)
  cashOutSession(
    @Param(
      'sessionId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    sessionId: string,
  ): Promise<CashOutSessionResponseDto> {
    return this.sessionsService.cashOutSession(
      sessionId,
    );
  }
}