import { Module } from "@nestjs/common";

import { IdempotencyModule } from "../idempotency/idempotency.module.js";

import { TransactionsController } from "./transactions.controller.js";
import { TransactionsService } from "./transactions.service.js";

@Module({
  imports: [IdempotencyModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
