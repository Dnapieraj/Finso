-- AlterEnum
ALTER TYPE "EmailCodePurpose" ADD VALUE 'EMAIL_CHANGE';

-- AlterTable
ALTER TABLE "EmailCode" ADD COLUMN     "newEmail" TEXT;
