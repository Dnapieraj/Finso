-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "beforeFinso" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ExpenseTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseTemplate_userId_idx" ON "ExpenseTemplate"("userId");

-- AddForeignKey
ALTER TABLE "ExpenseTemplate" ADD CONSTRAINT "ExpenseTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseTemplate" ADD CONSTRAINT "ExpenseTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: the onboarding's "spent since payday" expense on existing
-- accounts. At most one per user: the earliest expense with the onboarding's
-- note, the "Inne" category and no rule, saved together with the onboarding
-- (within 5 minutes of it). A later expense the user happened to note the
-- same way stays a normal expense. Tested in test/before-finso-backfill.
-- backfill:start
UPDATE "Transaction" AS t
SET "beforeFinso" = true
FROM (
    SELECT DISTINCT ON (tx."userId") tx."id"
    FROM "Transaction" AS tx
    JOIN "User" AS u ON u."id" = tx."userId"
    WHERE tx."note" = 'Wydatki przed Finso'
      AND tx."categoryId" = '00000000-0000-7000-8000-000000000008'
      AND tx."recurringRuleId" IS NULL
      AND u."onboardingCompletedAt" IS NOT NULL
      AND tx."createdAt" BETWEEN u."onboardingCompletedAt" - INTERVAL '5 minutes'
                             AND u."onboardingCompletedAt" + INTERVAL '5 minutes'
    ORDER BY tx."userId", tx."createdAt", tx."id"
) AS onboarding
WHERE t."id" = onboarding."id";
-- backfill:end
