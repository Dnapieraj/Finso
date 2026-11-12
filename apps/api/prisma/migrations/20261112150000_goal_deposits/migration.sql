-- Goal deposits (12.11.2026). "Already saved" becomes the base amount:
-- RENAME keeps every value (a DROP + ADD would wipe it). The total saved
-- is now baseAmount + the goal's deposits.

-- AlterTable
ALTER TABLE "Goal" RENAME COLUMN "currentAmount" TO "baseAmount";

-- CreateTable
CREATE TABLE "GoalDeposit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoalDeposit_userId_goalId_deletedAt_idx" ON "GoalDeposit"("userId", "goalId", "deletedAt");

-- AddForeignKey
ALTER TABLE "GoalDeposit" ADD CONSTRAINT "GoalDeposit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalDeposit" ADD CONSTRAINT "GoalDeposit_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
