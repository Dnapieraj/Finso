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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RecurringRule } from '@vireo/shared';
import {
  createRecurringRuleSchema,
  recurringRuleSchema,
  updateRecurringRuleSchema,
} from '@vireo/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';

import type { AuthUser } from '../auth/decorators.js';
import { CurrentUser } from '../auth/decorators.js';
import { RecurringRulesService } from './recurring-rules.service.js';

export class CreateRecurringRuleDto extends createZodDto(createRecurringRuleSchema) {}
export class UpdateRecurringRuleDto extends createZodDto(updateRecurringRuleSchema) {}
export class RecurringRuleDto extends createZodDto(recurringRuleSchema) {}

/** Stałe zobowiązania (EXPENSE) i harmonogramy wpływów (INCOME). */
@ApiTags('recurring-rules')
@ApiBearerAuth()
@Controller('recurring-rules')
export class RecurringRulesController {
  constructor(private readonly rules: RecurringRulesService) {}

  @Get()
  @ZodResponse({ type: [RecurringRuleDto] })
  list(@CurrentUser() user: AuthUser): Promise<RecurringRule[]> {
    return this.rules.list(user.id);
  }

  @Get(':id')
  @ZodResponse({ type: RecurringRuleDto })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<RecurringRule> {
    return this.rules.get(user.id, id);
  }

  @Post()
  @ZodResponse({ status: HttpStatus.CREATED, type: RecurringRuleDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateRecurringRuleDto,
  ): Promise<RecurringRule> {
    return this.rules.create(user.id, body);
  }

  @Patch(':id')
  @ZodResponse({ type: RecurringRuleDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateRecurringRuleDto,
  ): Promise<RecurringRule> {
    return this.rules.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.rules.remove(user.id, id);
  }
}
