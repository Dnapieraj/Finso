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
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { ExpenseTemplate } from "@vireo/shared";
import {
  createExpenseTemplateSchema,
  expenseTemplateSchema,
  updateExpenseTemplateSchema,
} from "@vireo/shared";
import { createZodDto, ZodResponse } from "nestjs-zod";

import type { AuthUser } from "../auth/decorators.js";
import { CurrentUser } from "../auth/decorators.js";
import { ExpenseTemplatesService } from "./expense-templates.service.js";

export class CreateExpenseTemplateDto extends createZodDto(createExpenseTemplateSchema) {}
export class UpdateExpenseTemplateDto extends createZodDto(updateExpenseTemplateSchema) {}
export class ExpenseTemplateDto extends createZodDto(expenseTemplateSchema) {}

@ApiTags("expense-templates")
@ApiBearerAuth()
@Controller("expense-templates")
export class ExpenseTemplatesController {
  constructor(private readonly templates: ExpenseTemplatesService) {}

  @Get()
  @ZodResponse({ type: [ExpenseTemplateDto] })
  list(@CurrentUser() user: AuthUser): Promise<ExpenseTemplate[]> {
    return this.templates.list(user.id);
  }

  @Get(":id")
  @ZodResponse({ type: ExpenseTemplateDto })
  get(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<ExpenseTemplate> {
    return this.templates.get(user.id, id);
  }

  @Post()
  @ZodResponse({ status: HttpStatus.CREATED, type: ExpenseTemplateDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateExpenseTemplateDto,
  ): Promise<ExpenseTemplate> {
    return this.templates.create(user.id, body);
  }

  @Patch(":id")
  @ZodResponse({ type: ExpenseTemplateDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: UpdateExpenseTemplateDto,
  ): Promise<ExpenseTemplate> {
    return this.templates.update(user.id, id, body);
  }

  /** Usuwa naprawdę — wydatki zapisane z szablonu zostają. */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    return this.templates.remove(user.id, id);
  }
}
