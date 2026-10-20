import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { ExportData } from "@vireo/shared";
import { exportDataSchema } from "@vireo/shared";
import { createZodDto, ZodResponse } from "nestjs-zod";

import type { AuthUser } from "../auth/decorators.js";
import { CurrentUser } from "../auth/decorators.js";
import { ExportService } from "./export.service.js";

export class ExportDataDto extends createZodDto(exportDataSchema) {}

/** Kopia danych użytkownika (RODO, art. 20) — appka robi z niej pliki CSV. */
@ApiTags("export")
@ApiBearerAuth()
@Controller("export")
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  @Get()
  @ZodResponse({ type: ExportDataDto })
  get(@CurrentUser() user: AuthUser): Promise<ExportData> {
    return this.exports.get(user.id);
  }
}
