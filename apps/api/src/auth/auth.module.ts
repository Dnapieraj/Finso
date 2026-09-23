import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';

import type { Env } from '../config/env.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }),
        },
        // Przypięcie algorytmu przy weryfikacji — bez tego biblioteka
        // ufałaby polu `alg` z nagłówka tokena, który kontroluje klient.
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
    // Pamięć throttlera jest w procesie — wystarcza dla jednej instancji.
    // Przy skalowaniu poziomym trzeba będzie storage w Redisie.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [
          {
            ttl: config.get('AUTH_THROTTLE_TTL_SECONDS', { infer: true }) * 1000,
            limit: config.get('AUTH_THROTTLE_LIMIT', { infer: true }),
          },
        ],
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    RefreshTokenService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [PasswordService],
})
export class AuthModule {}
