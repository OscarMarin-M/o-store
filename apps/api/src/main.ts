import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { existsSync } from 'node:fs';
import { AppModule } from './app/app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { runCli } from './cli';

// Nx ya carga .env al usar `nx serve`; esto cubre ejecutar el bundle directo con node.
if (existsSync('.env')) process.loadEnvFile('.env');

async function bootstrap() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    await runCli(args);
    return;
  }

  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  // Todas las respuestas de error salen con el formato ApiError de @o-stores/contracts.
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`API en http://localhost:${port}/${globalPrefix}`);
}

bootstrap().catch((error) => {
  Logger.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
