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
import type { Goal, GoalDeposit } from "@vireo/shared";
import {
  createGoalDepositSchema,
  createGoalSchema,
  goalDepositSchema,
  goalSchema,
  updateGoalSchema,
} from "@vireo/shared";
import { createZodDto, ZodResponse } from "nestjs-zod";

import type { AuthUser } from "../auth/decorators.js";
import { CurrentUser } from "../auth/decorators.js";
import { idempotentPost } from "../idempotency/idempotent-post.js";
import { IdempotencyService } from "../idempotency/idempotency.service.js";
import { GoalsService } from "./goals.service.js";

export class CreateGoalDto extends createZodDto(createGoalSchema) {}
export class UpdateGoalDto extends createZodDto(updateGoalSchema) {}
export class GoalDto extends createZodDto(goalSchema) {}
export class CreateGoalDepositDto extends createZodDto(createGoalDepositSchema) {}
export class GoalDepositDto extends createZodDto(goalDepositSchema) {}

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

  @Get(":id/deposits")
  @ZodResponse({ type: [GoalDepositDto] })
  listDeposits(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<GoalDeposit[]> {
    return this.goals.listDeposits(user.id, id);
  }

  /** Z `Idempotency-Key` ponowienie po zerwanym połączeniu nie wpłaca drugi raz. */
  @Post(":id/deposits")
  @ZodResponse({ status: HttpStatus.CREATED, type: GoalDepositDto })
  @ApiHeader({
    name: "Idempotency-Key",
    required: false,
    description: "UUID wpłaty; ten sam klucz przez 24 h zwraca ten sam wynik",
  })
  createDeposit(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: CreateGoalDepositDto,
    @Headers("idempotency-key") rawKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<GoalDeposit> {
    return idempotentPost(this.idempotency, {
      userId: user.id,
      // Cel w zakresie: ten sam klucz dla innego celu to inne żądanie.
      scope: `POST /goals/${id}/deposits`,
      rawKey,
      request: body,
      res,
      perform: (tx) => this.goals.createDeposit(user.id, id, body, tx),
    });
  }

  /** Miękkie usunięcie — do cofnięcia przez POST …/restore. */
  @Delete(":id/deposits/:depositId")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDeposit(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("depositId") depositId: string,
  ): Promise<void> {
    return this.goals.removeDeposit(user.id, id, depositId);
  }

  @Post(":id/deposits/:depositId/restore")
  @ZodResponse({ status: HttpStatus.OK, type: GoalDepositDto })
  restoreDeposit(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("depositId") depositId: string,
  ): Promise<GoalDeposit> {
    return this.goals.restoreDeposit(user.id, id, depositId);
  }
}
