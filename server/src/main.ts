import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(cookieParser());

  app.enableShutdownHooks();
  app.setGlobalPrefix('api');

  const configuredPort =
    configService.get<string>('PORT');

  const port = configuredPort
    ? Number(configuredPort)
    : 3000;

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(
      `Invalid PORT configuration: ${configuredPort}`,
    );
  }

  await app.listen(port);

  console.log(
    `Casino Jackpot API running at http://localhost:${port}/api`,
  );
}

void bootstrap().catch((error: unknown) => {
  console.error(
    'Casino Jackpot API failed to start:',
    error,
  );

  process.exitCode = 1;
});