import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Category } from '@vireo/shared';
import { ZodResponse } from 'nestjs-zod';

import type { AuthUser } from '../auth/decorators.js';
import { CurrentUser } from '../auth/decorators.js';
import { CategoriesService } from './categories.service.js';
import { CategoryDto, CreateCategoryDto, UpdateCategoryDto } from './categories.dto.js';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  /** Kategorie systemowe i własne użytkownika. */
  @Get()
  @ZodResponse({ type: [CategoryDto] })
  list(@CurrentUser() user: AuthUser): Promise<Category[]> {
    return this.categories.list(user.id);
  }

  @Get(':id')
  @ZodResponse({ type: CategoryDto })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<Category> {
    return this.categories.get(user.id, id);
  }

  @Post()
  @ZodResponse({ status: HttpStatus.CREATED, type: CategoryDto })
  create(@CurrentUser() user: AuthUser, @Body() body: CreateCategoryDto): Promise<Category> {
    return this.categories.create(user.id, body);
  }

  /** Tylko własne — kategorii systemowych nie da się edytować (404). */
  @Patch(':id')
  @ZodResponse({ type: CategoryDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto,
  ): Promise<Category> {
    return this.categories.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.categories.remove(user.id, id);
  }
}
