import { categorySchema, createCategorySchema, updateCategorySchema } from '@vireo/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateCategoryDto extends createZodDto(createCategorySchema) {}
export class UpdateCategoryDto extends createZodDto(updateCategorySchema) {}
export class CategoryDto extends createZodDto(categorySchema) {}
