-- Finso is a paid app (decision 12.11.2026): no Free/Plus plans and no
-- RevenueCat, so the plan and the RevenueCat customer id go away.

-- DropIndex
DROP INDEX "User_revenueCatId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "plan",
DROP COLUMN "revenueCatId";

-- DropEnum
DROP TYPE "SubscriptionPlan";
