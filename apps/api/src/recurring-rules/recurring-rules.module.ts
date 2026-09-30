import { Module } from "@nestjs/common";

import { IdempotencyModule } from "../idempotency/idempotency.module.js";
import { RecurringRulesController } from "./recurring-rules.controller.js";
import { RecurringRulesService } from "./recurring-rules.service.js";

@Module({
  imports: [IdempotencyModule],
  controllers: [RecurringRulesController],
  providers: [RecurringRulesService],
})
export class RecurringRulesModule {}
