-- AlterTable
ALTER TABLE "User" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

-- Konta sprzed onboardingu mają już swoje dane — nie pokazujemy im go.
UPDATE "User" SET "onboardingCompletedAt" = "createdAt";
