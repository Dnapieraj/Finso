import { Module } from "@nestjs/common";

import { BudgetModule } from "../budget/budget.module.js";
import { CategoryLimitsController } from "./category-limits.controller.js";
import { CategoryLimitsService } from "./category-limits.service.js";

@Module({
  imports: [BudgetModule],
  controllers: [CategoryLimitsController],
  providers: [CategoryLimitsService],
})
export class CategoryLimitsModule {}
