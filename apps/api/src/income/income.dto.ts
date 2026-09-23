import {
  createIncomeEntrySchema,
  createIncomeSourceSchema,
  incomeEntryPageSchema,
  incomeEntrySchema,
  incomeSourceSchema,
  listIncomeEntriesQuerySchema,
  updateIncomeEntrySchema,
  updateIncomeSourceSchema,
} from '@vireo/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateIncomeSourceDto extends createZodDto(createIncomeSourceSchema) {}
export class UpdateIncomeSourceDto extends createZodDto(updateIncomeSourceSchema) {}
export class IncomeSourceDto extends createZodDto(incomeSourceSchema) {}

export class CreateIncomeEntryDto extends createZodDto(createIncomeEntrySchema) {}
export class UpdateIncomeEntryDto extends createZodDto(updateIncomeEntrySchema) {}
export class ListIncomeEntriesQueryDto extends createZodDto(listIncomeEntriesQuerySchema) {}
export class IncomeEntryDto extends createZodDto(incomeEntrySchema) {}
export class IncomeEntryPageDto extends createZodDto(incomeEntryPageSchema) {}
