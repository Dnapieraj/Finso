import { Module } from "@nestjs/common";

import { ExpenseTemplatesController } from "./expense-templates.controller.js";
import { ExpenseTemplatesService } from "./expense-templates.service.js";

@Module({
  controllers: [ExpenseTemplatesController],
  providers: [ExpenseTemplatesService],
})
export class ExpenseTemplatesModule {}
