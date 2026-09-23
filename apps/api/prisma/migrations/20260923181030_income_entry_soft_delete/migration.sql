-- DropForeignKey
ALTER TABLE "IncomeEntry" DROP CONSTRAINT "IncomeEntry_incomeSourceId_fkey";

-- DropIndex
DROP INDEX "IncomeEntry_userId_date_idx";

-- AlterTable
ALTER TABLE "IncomeEntry" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "IncomeEntry_userId_deletedAt_date_idx" ON "IncomeEntry"("userId", "deletedAt", "date");

-- AddForeignKey
ALTER TABLE "IncomeEntry" ADD CONSTRAINT "IncomeEntry_incomeSourceId_fkey" FOREIGN KEY ("incomeSourceId") REFERENCES "IncomeSource"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
