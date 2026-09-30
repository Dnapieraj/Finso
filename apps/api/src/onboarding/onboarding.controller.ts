import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { PublicUser } from "@vireo/shared";
import { completeOnboardingSchema } from "@vireo/shared";
import { createZodDto, ZodResponse } from "nestjs-zod";

import type { AuthUser } from "../auth/decorators.js";
import { CurrentUser } from "../auth/decorators.js";
import { PublicUserDto } from "../users/users.controller.js";
import { OnboardingService } from "./onboarding.service.js";

export class CompleteOnboardingDto extends createZodDto(completeOnboardingSchema) {}

@ApiTags("users")
@ApiBearerAuth()
@Controller("users/me/onboarding")
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /**
   * Wszystkie odpowiedzi z onboardingu naraz. 200, nie 201: zmienia konto
   * (i zwraca je), a nie tworzy zasobu pod nowym adresem. 409, gdy
   * onboarding był już ukończony — klient wtedy po prostu idzie dalej.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: HttpStatus.OK, type: PublicUserDto })
  complete(
    @CurrentUser() user: AuthUser,
    @Body() body: CompleteOnboardingDto,
  ): Promise<PublicUser> {
    return this.onboarding.complete(user.id, body);
  }
}
