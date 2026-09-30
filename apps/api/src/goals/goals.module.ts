import { Module } from "@nestjs/common";

import { IdempotencyModule } from "../idempotency/idempotency.module.js";
import { GoalsController } from "./goals.controller.js";
import { GoalsService } from "./goals.service.js";

@Module({
  imports: [IdempotencyModule],
  controllers: [GoalsController],
  providers: [GoalsService],
})
export class GoalsModule {}
