import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Wyłącza globalny JwtAuthGuard dla endpointu lub kontrolera.
 * Domyślnie wszystko jest chronione — zapomniany dekorator oznacza 401,
 * a nie przypadkowo publiczne dane.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Zalogowany użytkownik, jak go widzi reszta API po weryfikacji tokena. */
export interface AuthUser {
  id: string;
}

/** Request po przejściu przez JwtAuthGuard. */
export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

/**
 * Wstrzykuje zalogowanego użytkownika do handlera: `@CurrentUser() user: AuthUser`.
 * Rzuca, jeśli użyty na endpoincie `@Public()` — tam `user` nie istnieje
 * i to błąd programisty, nie klienta.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new Error('@CurrentUser() used on a route without JwtAuthGuard');
    }
    return request.user;
  },
);
