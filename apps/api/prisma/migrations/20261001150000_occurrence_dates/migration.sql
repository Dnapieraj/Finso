-- AlterTable
ALTER TABLE "IncomeEntry" ADD COLUMN     "occurrenceDate" DATE;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "occurrenceDate" DATE;

-- CreateIndex
CREATE UNIQUE INDEX "IncomeEntry_incomeSourceId_occurrenceDate_key" ON "IncomeEntry"("incomeSourceId", "occurrenceDate");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_recurringRuleId_occurrenceDate_key" ON "Transaction"("recurringRuleId", "occurrenceDate");

