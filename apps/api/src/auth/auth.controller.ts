import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthSession, AuthTokens } from '@vireo/shared';
import { ZodSerializerDto } from 'nestjs-zod';

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
@Public()
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ZodSerializerDto(AuthSessionDto)
  register(@Body() body: RegisterDto): Promise<AuthSession> {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(AuthSessionDto)
  login(@Body() body: LoginDto): Promise<AuthSession> {
    return this.auth.login(body);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(AuthTokensDto)
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
