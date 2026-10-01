import { Module } from "@nestjs/common";

import { BudgetModule } from "../budget/budget.module.js";
import { ConfirmationsController } from "./confirmations.controller.js";
import { ConfirmationsService } from "./confirmations.service.js";

@Module({
  imports: [BudgetModule],
  controllers: [ConfirmationsController],
  providers: [ConfirmationsService],
})
export class ConfirmationsModule {}
