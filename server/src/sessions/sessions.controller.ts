import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CashOutSessionResponseDto } from './dto/cash-out-session-response.dto';
import { CreateSessionResponseDto } from './dto/create-session-response.dto';
import { SessionsService } from './sessions.service';
import { GetSessionResponseDto } from './dto/get-session-response.dto';
import { RollSessionResponseDto } from './dto/roll-session-response.dto';

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

  @Get(':sessionId')
  getSession(
    @Param(
      'sessionId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    sessionId: string,
  ): Promise<GetSessionResponseDto> {
    return this.sessionsService.getSession(sessionId);
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

  @Post(':sessionId/roll')
  @HttpCode(HttpStatus.OK)
  rollSession(
    @Param(
      'sessionId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    sessionId: string,
  ): Promise<RollSessionResponseDto> {
    return this.sessionsService.rollSession(
      sessionId,
    );
  }
}