import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { z } from 'zod';

import type { AuthenticatedRequest } from './decorators.js';
import { IS_PUBLIC_KEY } from './decorators.js';

/**
 * Payload po weryfikacji podpisu też walidujemy: poprawny podpis mówi
 * "to wydał nasz serwer", ale nie "ma pola sub typu string".
 */
const accessTokenPayloadSchema = z.object({ sub: z.string().min(1) });

/**
 * Globalny guard (APP_GUARD): każdy endpoint wymaga ważnego access tokena
 * w nagłówku `Authorization: Bearer <token>`, chyba że ma `@Public()`.
 *
 * Bezstanowy — nie pyta bazy. To świadomy kompromis krótkiego access
 * tokena: po wylogowaniu lub usunięciu konta token działa jeszcze do
 * wygaśnięcia (max JWT_ACCESS_TTL_SECONDS), ale zapytania filtrowane po
 * userId usuniętego konta i tak nic nie znajdą.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException();
    }

    let payload: unknown;
    try {
      // Algorytm przypięty w JwtModule (verifyOptions.algorithms) — token
      // z nagłówkiem `alg: none` czy innym algorytmem zostanie odrzucony.
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException();
    }

    const parsed = accessTokenPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new UnauthorizedException();
    }
    request.user = { id: parsed.data.sub };
    return true;
  }
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}
