import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { RecurringRule } from "@vireo/shared";
import {
  createRecurringRuleSchema,
  recurringRuleSchema,
  updateRecurringRuleSchema,
} from "@vireo/shared";
import { createZodDto, ZodResponse } from "nestjs-zod";

import type { AuthUser } from "../auth/decorators.js";
import { CurrentUser } from "../auth/decorators.js";
import { idempotentPost } from "../idempotency/idempotent-post.js";
import { IdempotencyService } from "../idempotency/idempotency.service.js";
import { RecurringRulesService } from "./recurring-rules.service.js";

export class CreateRecurringRuleDto extends createZodDto(createRecurringRuleSchema) {}
export class UpdateRecurringRuleDto extends createZodDto(updateRecurringRuleSchema) {}
export class RecurringRuleDto extends createZodDto(recurringRuleSchema) {}

/** Stałe zobowiązania (EXPENSE) i harmonogramy wpływów (INCOME). */
@ApiTags("recurring-rules")
@ApiBearerAuth()
@Controller("recurring-rules")
export class RecurringRulesController {
  constructor(
    private readonly rules: RecurringRulesService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Get()
  @ZodResponse({ type: [RecurringRuleDto] })
  list(@CurrentUser() user: AuthUser): Promise<RecurringRule[]> {
    return this.rules.list(user.id);
  }

  @Get(":id")
  @ZodResponse({ type: RecurringRuleDto })
  get(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<RecurringRule> {
    return this.rules.get(user.id, id);
  }

  /** Z `Idempotency-Key` ponowienie zwraca zapisaną regułę zamiast drugiej. */
  @Post()
  @ZodResponse({ status: HttpStatus.CREATED, type: RecurringRuleDto })
  @ApiHeader({
    name: "Idempotency-Key",
    required: false,
    description: "UUID reguły; ten sam klucz przez 24 h zwraca ten sam wynik",
  })
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateRecurringRuleDto,
    @Headers("idempotency-key") rawKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RecurringRule> {
    return idempotentPost(this.idempotency, {
      userId: user.id,
      scope: "POST /recurring-rules",
      rawKey,
      request: body,
      res,
      perform: (tx) => this.rules.create(user.id, body, tx),
    });
  }

  @Patch(":id")
  @ZodResponse({ type: RecurringRuleDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: UpdateRecurringRuleDto,
  ): Promise<RecurringRule> {
    return this.rules.update(user.id, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    return this.rules.remove(user.id, id);
  }
}
