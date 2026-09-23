import { Body, Controller, Delete, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { deleteAccountSchema, publicUserSchema } from '@vireo/shared';
import type { PublicUser } from '@vireo/shared';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';

import type { AuthUser } from '../auth/decorators.js';
import { CurrentUser } from '../auth/decorators.js';
import { UsersService } from './users.service.js';

export class DeleteAccountDto extends createZodDto(deleteAccountSchema) {}
export class PublicUserDto extends createZodDto(publicUserSchema) {}

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ZodSerializerDto(PublicUserDto)
  getMe(@CurrentUser() user: AuthUser): Promise<PublicUser> {
    return this.users.getMe(user.id);
  }

  /**
   * DELETE z body jest poprawny w HTTP, choć nietypowy — tu świadomie:
   * hasło nie może iść w URL-u (trafiłoby do logów serwera i proxy).
   * Limitowany jak /auth/*, bo to też endpoint weryfikujący hasło.
   */
  @Delete('me')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMe(@CurrentUser() user: AuthUser, @Body() body: DeleteAccountDto): Promise<void> {
    return this.users.deleteAccount(user.id, body.password);
  }
}
