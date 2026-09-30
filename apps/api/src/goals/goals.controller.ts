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
import type { Goal } from "@vireo/shared";
import { createGoalSchema, goalSchema, updateGoalSchema } from "@vireo/shared";
import { createZodDto, ZodResponse } from "nestjs-zod";

import type { AuthUser } from "../auth/decorators.js";
import { CurrentUser } from "../auth/decorators.js";
import { idempotentPost } from "../idempotency/idempotent-post.js";
import { IdempotencyService } from "../idempotency/idempotency.service.js";
import { GoalsService } from "./goals.service.js";

export class CreateGoalDto extends createZodDto(createGoalSchema) {}
export class UpdateGoalDto extends createZodDto(updateGoalSchema) {}
export class GoalDto extends createZodDto(goalSchema) {}

@ApiTags("goals")
@ApiBearerAuth()
@Controller("goals")
export class GoalsController {
  constructor(
    private readonly goals: GoalsService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Get()
  @ZodResponse({ type: [GoalDto] })
  list(@CurrentUser() user: AuthUser): Promise<Goal[]> {
    return this.goals.list(user.id);
  }

  @Get(":id")
  @ZodResponse({ type: GoalDto })
  get(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<Goal> {
    return this.goals.get(user.id, id);
  }

  /** Z `Idempotency-Key` ponowienie zwraca zapisany cel zamiast drugiego. */
  @Post()
  @ZodResponse({ status: HttpStatus.CREATED, type: GoalDto })
  @ApiHeader({
    name: "Idempotency-Key",
    required: false,
    description: "UUID celu; ten sam klucz przez 24 h zwraca ten sam wynik",
  })
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateGoalDto,
    @Headers("idempotency-key") rawKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Goal> {
    return idempotentPost(this.idempotency, {
      userId: user.id,
      scope: "POST /goals",
      rawKey,
      request: body,
      res,
      perform: (tx) => this.goals.create(user.id, body, tx),
    });
  }

  @Patch(":id")
  @ZodResponse({ type: GoalDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: UpdateGoalDto,
  ): Promise<Goal> {
    return this.goals.update(user.id, id, body);
  }

  /** Miękkie usunięcie — do cofnięcia przez POST /goals/:id/restore. */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    return this.goals.remove(user.id, id);
  }

  @Post(":id/restore")
  @ZodResponse({ status: HttpStatus.OK, type: GoalDto })
  restore(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<Goal> {
    return this.goals.restore(user.id, id);
  }
}
