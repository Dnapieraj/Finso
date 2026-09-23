import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Transaction, TransactionPage } from '@vireo/shared';
import { ZodResponse } from 'nestjs-zod';

import type { AuthUser } from '../auth/decorators.js';
import { CurrentUser } from '../auth/decorators.js';
import {
  CreateTransactionDto,
  ListTransactionsQueryDto,
  TransactionDto,
  TransactionPageDto,
  UpdateTransactionDto,
} from './transactions.dto.js';
import { TransactionsService } from './transactions.service.js';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  @ZodResponse({ type: TransactionPageDto })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListTransactionsQueryDto,
  ): Promise<TransactionPage> {
    return this.transactions.list(user.id, query);
  }

  @Get(':id')
  @ZodResponse({ type: TransactionDto })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<Transaction> {
    return this.transactions.get(user.id, id);
  }

  @Post()
  @ZodResponse({ status: HttpStatus.CREATED, type: TransactionDto })
  create(@CurrentUser() user: AuthUser, @Body() body: CreateTransactionDto): Promise<Transaction> {
    return this.transactions.create(user.id, body);
  }

  @Patch(':id')
  @ZodResponse({ type: TransactionDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateTransactionDto,
  ): Promise<Transaction> {
    return this.transactions.update(user.id, id, body);
  }

  /** Miękkie usunięcie — do cofnięcia przez POST /transactions/:id/restore. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.transactions.remove(user.id, id);
  }

  @Post(':id/restore')
  @ZodResponse({ status: HttpStatus.OK, type: TransactionDto })
  restore(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<Transaction> {
    return this.transactions.restore(user.id, id);
  }
}
