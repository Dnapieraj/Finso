import { Module } from "@nestjs/common";

import { IdempotencySweeper } from "./idempotency-sweeper.js";
import { IdempotencyService } from "./idempotency.service.js";

@Module({
  providers: [IdempotencyService, IdempotencySweeper],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
