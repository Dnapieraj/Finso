import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';
import { setupSwagger } from './swagger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  // Bez tego onModuleDestroy (i $disconnect w PrismaService) nigdy się nie
  // wywoła przy SIGTERM/SIGINT — połączenia do bazy zostałyby wiszące.
  app.enableShutdownHooks();
  // Na produkcji dokumentacja nie jest publiczna — mapa wszystkich
  // endpointów to niepotrzebna pomoc dla atakującego. Web i mobile
  // korzystają z typów z @vireo/shared, nie z OpenAPI.
  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    setupSwagger(app);
  }
  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
