import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthSession, AuthTokens } from '@vireo/shared';
import { ZodResponse } from 'nestjs-zod';

import {
  AuthSessionDto,
  AuthTokensDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
} from './auth.dto.js';
import { AuthService } from './auth.service.js';
import { Public } from './decorators.js';

/**
 * Wszystkie endpointy publiczne (klient nie ma jeszcze access tokena albo
 * ten wygasł) i wszystkie limitowane — to one są celem ataków słownikowych
 * i credential stuffingu.
 */
@ApiTags('auth')
@Public()
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ZodResponse({ status: HttpStatus.CREATED, type: AuthSessionDto })
  register(@Body() body: RegisterDto): Promise<AuthSession> {
    return this.auth.register(body);
  }

  @Post('login')
  @ZodResponse({ status: HttpStatus.OK, type: AuthSessionDto })
  login(@Body() body: LoginDto): Promise<AuthSession> {
    return this.auth.login(body);
  }

  @Post('refresh')
  @ZodResponse({ status: HttpStatus.OK, type: AuthTokensDto })
  refresh(@Body() body: RefreshTokenDto): Promise<AuthTokens> {
    return this.auth.refresh(body.refreshToken);
  }

  /**
   * Publiczne, bo klient wylogowuje się też z wygasłym access tokenem.
   * Posiadanie refresh tokena wystarcza jako dowód, że to ta sesja.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() body: RefreshTokenDto): Promise<void> {
    return this.auth.logout(body.refreshToken);
  }
}
