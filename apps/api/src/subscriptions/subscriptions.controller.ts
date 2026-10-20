import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { RecurringRule, SubscriptionsOverview } from "@vireo/shared";
import {
  confirmSubscriptionSchema,
  dismissSubscriptionSchema,
  recurringRuleSchema,
  subscriptionsOverviewSchema,
  undismissSubscriptionQuerySchema,
} from "@vireo/shared";
import { createZodDto, ZodResponse } from "nestjs-zod";

import type { AuthUser } from "../auth/decorators.js";
import { CurrentUser } from "../auth/decorators.js";
import { idempotentPost } from "../idempotency/idempotent-post.js";
import { IdempotencyService } from "../idempotency/idempotency.service.js";
import { SubscriptionsService } from "./subscriptions.service.js";

export class ConfirmSubscriptionDto extends createZodDto(confirmSubscriptionSchema) {}
export class DismissSubscriptionDto extends createZodDto(dismissSubscriptionSchema) {}
export class UndismissSubscriptionQueryDto extends createZodDto(undismissSubscriptionQuerySchema) {}
export class SubscriptionsOverviewDto extends createZodDto(subscriptionsOverviewSchema) {}
export class SubscriptionRuleDto extends createZodDto(recurringRuleSchema) {}

/** Detektor subskrypcji: potwierdzone, wykryte, „To subskrypcja” i „To nie subskrypcja”. */
@ApiTags("subscriptions")
@ApiBearerAuth()
@Controller("subscriptions")
export class SubscriptionsController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly idempotency: IdempotencyService,
  ) {}

  /** Wykryte pozycje liczone na bieżąco z wydatków; suma główna tylko z potwierdzonych. */
  @Get()
  @ZodResponse({ type: SubscriptionsOverviewDto })
  overview(@CurrentUser() user: AuthUser): Promise<SubscriptionsOverview> {
    return this.subscriptions.overview(user.id);
  }

  /** Zamienia wykrytą pozycję w stałą płatność. 404, gdy klucza nie ma wśród wykrytych. */
  @Post("confirm")
  @ZodResponse({ status: HttpStatus.CREATED, type: SubscriptionRuleDto })
  @ApiHeader({
    name: "Idempotency-Key",
    required: false,
    description: "UUID potwierdzenia; ten sam klucz przez 24 h zwraca ten sam wynik",
  })
  confirm(
    @CurrentUser() user: AuthUser,
    @Body() body: ConfirmSubscriptionDto,
    @Headers("idempotency-key") rawKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RecurringRule> {
    return idempotentPost(this.idempotency, {
      userId: user.id,
      scope: "POST /subscriptions/confirm",
      rawKey,
      request: body,
      res,
      perform: (tx) => this.subscriptions.confirm(user.id, body, tx),
    });
  }

  @Post("dismissals")
  @HttpCode(HttpStatus.NO_CONTENT)
  dismiss(@CurrentUser() user: AuthUser, @Body() body: DismissSubscriptionDto): Promise<void> {
    return this.subscriptions.dismiss(user.id, body.key);
  }

  @Delete("dismissals")
  @HttpCode(HttpStatus.NO_CONTENT)
  undismiss(
    @CurrentUser() user: AuthUser,
    @Query() query: UndismissSubscriptionQueryDto,
  ): Promise<void> {
    return this.subscriptions.undismiss(user.id, query.key);
  }
}
