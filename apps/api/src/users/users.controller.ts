import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import { deleteAccountSchema, publicUserSchema, updateMeSchema } from "@vireo/shared";
import type { AuthTokens, PublicUser } from "@vireo/shared";
import { createZodDto, ZodResponse } from "nestjs-zod";

import type { AuthUser } from "../auth/decorators.js";
import { AuthTokensDto, ChangePasswordDto, VerifyEmailDto } from "../auth/auth.dto.js";
import { AuthService } from "../auth/auth.service.js";
import { CurrentUser } from "../auth/decorators.js";
import { UsersService } from "./users.service.js";

export class DeleteAccountDto extends createZodDto(deleteAccountSchema) {}
export class UpdateMeDto extends createZodDto(updateMeSchema) {}
export class PublicUserDto extends createZodDto(publicUserSchema) {}

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  @Get("me")
  @ZodResponse({ type: PublicUserDto })
  getMe(@CurrentUser() user: AuthUser): Promise<PublicUser> {
    return this.users.getMe(user.id);
  }

  @Patch("me")
  @ZodResponse({ type: PublicUserDto })
  updateMe(@CurrentUser() user: AuthUser, @Body() body: UpdateMeDto): Promise<PublicUser> {
    return this.users.updateMe(user.id, body);
  }

  /**
   * DELETE z body jest poprawny w HTTP, choć nietypowy — tu świadomie:
   * hasło nie może iść w URL-u (trafiłoby do logów serwera i proxy).
   * Limitowany jak /auth/*, bo to też endpoint weryfikujący hasło.
   */
  @Delete("me")
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMe(@CurrentUser() user: AuthUser, @Body() body: DeleteAccountDto): Promise<void> {
    return this.users.deleteAccount(user.id, body.password);
  }

  /** Nowy kod potwierdzający adres. 503, gdy e-mail nie wyszedł — appka to powie. */
  @Post("me/email/verification")
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  sendEmailVerification(@CurrentUser() user: AuthUser): Promise<void> {
    return this.users.sendEmailVerification(user.id);
  }

  /** Limitowany jak /auth/*: to zgadywanie kodu. 400 = zły albo wygasły kod. */
  @Post("me/email/verify")
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ type: PublicUserDto })
  verifyEmail(@CurrentUser() user: AuthUser, @Body() body: VerifyEmailDto): Promise<PublicUser> {
    return this.users.verifyEmail(user.id, body.code);
  }

  /** Zmiana hasła; zwraca nowe tokeny tej sesji (pozostałe się kończą). */
  @Post("me/password")
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ type: AuthTokensDto })
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() body: ChangePasswordDto,
  ): Promise<AuthTokens> {
    return this.auth.changePassword(user.id, body);
  }
}
