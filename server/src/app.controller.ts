import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import type { AliveResponse } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('alive')
  getAlive(): Promise<AliveResponse> {
    return this.appService.getAlive();
  }
}
