import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  transactionPageSchema,
  transactionSchema,
  transactionSummaryQuerySchema,
  transactionSummarySchema,
  updateTransactionSchema,
} from "@vireo/shared";
import { createZodDto } from "nestjs-zod";

export class CreateTransactionDto extends createZodDto(createTransactionSchema) {}
export class UpdateTransactionDto extends createZodDto(updateTransactionSchema) {}
export class ListTransactionsQueryDto extends createZodDto(listTransactionsQuerySchema) {}
export class TransactionDto extends createZodDto(transactionSchema) {}
export class TransactionPageDto extends createZodDto(transactionPageSchema) {}
export class TransactionSummaryQueryDto extends createZodDto(transactionSummaryQuerySchema) {}
export class TransactionSummaryDto extends createZodDto(transactionSummarySchema) {}
