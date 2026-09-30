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
import type { Transaction, TransactionPage, TransactionSummary } from "@vireo/shared";
import type { Response } from "express";
import { ZodResponse } from "nestjs-zod";

import type { AuthUser } from "../auth/decorators.js";
import { CurrentUser } from "../auth/decorators.js";
import {
  CreateTransactionDto,
  ListTransactionsQueryDto,
  TransactionDto,
  TransactionPageDto,
  TransactionSummaryDto,
  TransactionSummaryQueryDto,
  UpdateTransactionDto,
} from "./transactions.dto.js";
import { idempotentPost } from "../idempotency/idempotent-post.js";
import { IdempotencyService } from "../idempotency/idempotency.service.js";
import { TransactionsService } from "./transactions.service.js";

@ApiTags("transactions")
@ApiBearerAuth()
@Controller("transactions")
export class TransactionsController {
  constructor(
    private readonly transactions: TransactionsService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Get()
  @ZodResponse({ type: TransactionPageDto })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListTransactionsQueryDto,
  ): Promise<TransactionPage> {
    return this.transactions.list(user.id, query);
  }

  /**
   * Sumy do wykresu wydatków wg kategorii. Przed `:id` — inaczej Nest
   * dopasowałby "summary" jako id wydatku.
   */
  @Get("summary")
  @ZodResponse({ type: TransactionSummaryDto })
  summary(
    @CurrentUser() user: AuthUser,
    @Query() query: TransactionSummaryQueryDto,
  ): Promise<TransactionSummary> {
    return this.transactions.summary(user.id, query);
  }

  @Get(":id")
  @ZodResponse({ type: TransactionDto })
  get(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<Transaction> {
    return this.transactions.get(user.id, id);
  }

  /**
   * Z nagłówkiem `Idempotency-Key` (UUID) ponowione żądanie zwraca zapisaną
   * odpowiedź zamiast drugiego wydatku, np. po zerwanym połączeniu.
   * Bez nagłówka — jak dotąd, każde żądanie to nowy wydatek.
   */
  @Post()
  @ZodResponse({ status: HttpStatus.CREATED, type: TransactionDto })
  @ApiHeader({
    name: "Idempotency-Key",
    required: false,
    description: "UUID wydatku; ten sam klucz przez 24 h zwraca ten sam wynik",
  })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateTransactionDto,
    @Headers("idempotency-key") rawKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Transaction> {
    return idempotentPost(this.idempotency, {
      userId: user.id,
      scope: "POST /transactions",
      rawKey,
      request: body,
      res,
      perform: (tx) => this.transactions.create(user.id, body, tx),
    });
  }

  @Patch(":id")
  @ZodResponse({ type: TransactionDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: UpdateTransactionDto,
  ): Promise<Transaction> {
    return this.transactions.update(user.id, id, body);
  }

  /** Miękkie usunięcie — do cofnięcia przez POST /transactions/:id/restore. */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    return this.transactions.remove(user.id, id);
  }

  @Post(":id/restore")
  @ZodResponse({ status: HttpStatus.OK, type: TransactionDto })
  restore(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<Transaction> {
    return this.transactions.restore(user.id, id);
  }
}
