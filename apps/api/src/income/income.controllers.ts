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
  Query,
  Res,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { IncomeEntry, IncomeEntryPage, IncomeSource } from "@vireo/shared";
import { ZodResponse } from "nestjs-zod";

import type { AuthUser } from "../auth/decorators.js";
import { CurrentUser } from "../auth/decorators.js";
import { idempotentPost } from "../idempotency/idempotent-post.js";
import { IdempotencyService } from "../idempotency/idempotency.service.js";
import { IncomeEntriesService } from "./income-entries.service.js";
import { IncomeSourcesService } from "./income-sources.service.js";
import {
  CreateIncomeEntryDto,
  CreateIncomeSourceDto,
  IncomeEntryDto,
  IncomeEntryPageDto,
  IncomeSourceDto,
  ListIncomeEntriesQueryDto,
  UpdateIncomeEntryDto,
  UpdateIncomeSourceDto,
} from "./income.dto.js";

@ApiTags("income")
@ApiBearerAuth()
@Controller("income/sources")
export class IncomeSourcesController {
  constructor(
    private readonly sources: IncomeSourcesService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Get()
  @ZodResponse({ type: [IncomeSourceDto] })
  list(@CurrentUser() user: AuthUser): Promise<IncomeSource[]> {
    return this.sources.list(user.id);
  }

  @Get(":id")
  @ZodResponse({ type: IncomeSourceDto })
  get(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<IncomeSource> {
    return this.sources.get(user.id, id);
  }

  /** Z `Idempotency-Key` ponowienie zwraca zapisane źródło zamiast drugiego. */
  @Post()
  @ZodResponse({ status: HttpStatus.CREATED, type: IncomeSourceDto })
  @ApiHeader({
    name: "Idempotency-Key",
    required: false,
    description: "UUID źródła; ten sam klucz przez 24 h zwraca ten sam wynik",
  })
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateIncomeSourceDto,
    @Headers("idempotency-key") rawKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IncomeSource> {
    return idempotentPost(this.idempotency, {
      userId: user.id,
      scope: "POST /income/sources",
      rawKey,
      request: body,
      res,
      perform: (tx) => this.sources.create(user.id, body, tx),
    });
  }

  @Patch(":id")
  @ZodResponse({ type: IncomeSourceDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: UpdateIncomeSourceDto,
  ): Promise<IncomeSource> {
    return this.sources.update(user.id, id, body);
  }

  /** Tylko źródło bez wpływów (409 w przeciwnym razie). Do archiwizacji służy `isActive: false`. */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    return this.sources.remove(user.id, id);
  }
}

@ApiTags("income")
@ApiBearerAuth()
@Controller("income/entries")
export class IncomeEntriesController {
  constructor(private readonly entries: IncomeEntriesService) {}

  @Get()
  @ZodResponse({ type: IncomeEntryPageDto })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListIncomeEntriesQueryDto,
  ): Promise<IncomeEntryPage> {
    return this.entries.list(user.id, query);
  }

  @Get(":id")
  @ZodResponse({ type: IncomeEntryDto })
  get(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<IncomeEntry> {
    return this.entries.get(user.id, id);
  }

  @Post()
  @ZodResponse({ status: HttpStatus.CREATED, type: IncomeEntryDto })
  create(@CurrentUser() user: AuthUser, @Body() body: CreateIncomeEntryDto): Promise<IncomeEntry> {
    return this.entries.create(user.id, body);
  }

  @Patch(":id")
  @ZodResponse({ type: IncomeEntryDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: UpdateIncomeEntryDto,
  ): Promise<IncomeEntry> {
    return this.entries.update(user.id, id, body);
  }

  /** Miękkie usunięcie — do cofnięcia przez POST /income/entries/:id/restore. */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    return this.entries.remove(user.id, id);
  }

  @Post(":id/restore")
  @ZodResponse({ status: HttpStatus.OK, type: IncomeEntryDto })
  restore(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<IncomeEntry> {
    return this.entries.restore(user.id, id);
  }
}
