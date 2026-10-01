import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiNoContentResponse, ApiTags } from "@nestjs/swagger";
import type { DueConfirmation } from "@vireo/shared";
import { answerConfirmationSchema, dueConfirmationListSchema } from "@vireo/shared";
import { createZodDto, ZodResponse } from "nestjs-zod";

import type { AuthUser } from "../auth/decorators.js";
import { CurrentUser } from "../auth/decorators.js";
import { ConfirmationsService } from "./confirmations.service.js";

class AnswerConfirmationDto extends createZodDto(answerConfirmationSchema) {}
class DueConfirmationListDto extends createZodDto(dueConfirmationListSchema) {}

@ApiTags("confirmations")
@ApiBearerAuth()
@Controller("confirmations")
export class ConfirmationsController {
  constructor(private readonly confirmations: ConfirmationsService) {}

  /** Wpływy i stałe płatności czekające na odpowiedź — bieżące i zaległe. */
  @Get()
  @ZodResponse({ type: DueConfirmationListDto })
  due(@CurrentUser() user: AuthUser): Promise<DueConfirmation[]> {
    return this.confirmations.due(user.id);
  }

  /**
   * Odpowiedź na pytanie o termin. 204 — klient i tak odświeża budżet
   * i listę, a powtórzenie tej samej odpowiedzi niczego nie zmienia.
   */
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  answer(@CurrentUser() user: AuthUser, @Body() body: AnswerConfirmationDto): Promise<void> {
    return this.confirmations.answer(user.id, body);
  }
}
