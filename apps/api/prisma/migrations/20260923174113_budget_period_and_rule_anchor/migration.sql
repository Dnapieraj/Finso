/*
  Warnings:

  - Added the required column `startDate` to the `RecurringRule` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "RecurringRule" ADD COLUMN     "startDate" DATE NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "periodStartDay" INTEGER NOT NULL DEFAULT 1;
