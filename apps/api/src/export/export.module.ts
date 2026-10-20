import { Module } from "@nestjs/common";

import { CategoriesModule } from "../categories/categories.module.js";
import { GoalsModule } from "../goals/goals.module.js";
import { IncomeModule } from "../income/income.module.js";
import { RecurringRulesModule } from "../recurring-rules/recurring-rules.module.js";
import { ExportController } from "./export.controller.js";
import { ExportService } from "./export.service.js";

@Module({
  imports: [CategoriesModule, GoalsModule, IncomeModule, RecurringRulesModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
