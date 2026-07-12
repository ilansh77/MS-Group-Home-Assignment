import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.setGlobalPrefix('casino-jackpot');

  const configuredPort = configService.get<string>('PORT');
  const port = configuredPort ? Number(configuredPort) : 3000;

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT configuration: ${configuredPort}`);
  }

  await app.listen(port);

  console.log(`Casino Jackpot API running at http://localhost:${port}/casino-jackpot`);
}

void bootstrap();