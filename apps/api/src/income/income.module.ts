import { Module } from "@nestjs/common";

import { IdempotencyModule } from "../idempotency/idempotency.module.js";
import { IncomeEntriesController, IncomeSourcesController } from "./income.controllers.js";
import { IncomeEntriesService } from "./income-entries.service.js";
import { IncomeSourcesService } from "./income-sources.service.js";

@Module({
  imports: [IdempotencyModule],
  controllers: [IncomeSourcesController, IncomeEntriesController],
  providers: [IncomeSourcesService, IncomeEntriesService],
})
export class IncomeModule {}
