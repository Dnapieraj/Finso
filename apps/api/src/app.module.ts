import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor } from 'nestjs-zod';

import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { ZodValidationPipe } from './common/zod-validation.pipe.js';
import { validateEnv } from './config/env.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    // Rejestracja przez APP_* zamiast app.useGlobalPipes() w main.ts:
    // działa też w testach e2e, które budują aplikację z AppModule
    // i nigdy nie wywołują main.ts.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
  ],
})
export class AppModule {}
