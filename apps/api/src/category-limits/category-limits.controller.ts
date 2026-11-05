import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { CategoryLimitsOverview } from "@vireo/shared";
import { categoryLimitsOverviewSchema, setCategoryLimitSchema } from "@vireo/shared";
import { createZodDto, ZodResponse } from "nestjs-zod";

import type { AuthUser } from "../auth/decorators.js";
import { CurrentUser } from "../auth/decorators.js";
import { CategoryLimitsService } from "./category-limits.service.js";

export class SetCategoryLimitDto extends createZodDto(setCategoryLimitSchema) {}
export class CategoryLimitsOverviewDto extends createZodDto(categoryLimitsOverviewSchema) {}

@ApiTags("category-limits")
@ApiBearerAuth()
@Controller("category-limits")
export class CategoryLimitsController {
  constructor(private readonly limits: CategoryLimitsService) {}

  /** Limity ze stanem w bieżącym okresie i podpowiedzi „chudego miesiąca”. */
  @Get()
  @ZodResponse({ type: CategoryLimitsOverviewDto })
  overview(@CurrentUser() user: AuthUser): Promise<CategoryLimitsOverview> {
    return this.limits.overview(user.id);
  }

  /** Jeden limit na kategorię: ustawia albo zmienia kwotę. */
  @Put(":categoryId")
  @HttpCode(HttpStatus.NO_CONTENT)
  set(
    @CurrentUser() user: AuthUser,
    @Param("categoryId") categoryId: string,
    @Body() body: SetCategoryLimitDto,
  ): Promise<void> {
    return this.limits.set(user.id, categoryId, body);
  }

  /** Usuwa naprawdę — wydatki zostają. */
  @Delete(":categoryId")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param("categoryId") categoryId: string): Promise<void> {
    return this.limits.remove(user.id, categoryId);
  }
}
