import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const configuredPort =
    configService.get<string>('PORT') ?? '3000';

  const port = Number(configuredPort);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(
      `Invalid PORT configuration: ${configuredPort}`,
    );
  }

  const clientOrigin =
    configService.get<string>('CLIENT_ORIGIN') ??
    'http://localhost:4200';

  app.use(cookieParser());

  app.enableCors({
    origin: clientOrigin,
    credentials: true,
  });

  app.enableShutdownHooks();
  app.setGlobalPrefix('api');

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