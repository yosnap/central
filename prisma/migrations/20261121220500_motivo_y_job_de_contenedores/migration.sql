-- AlterTable
ALTER TABLE "ServerContainer" ADD COLUMN     "job" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reason" TEXT;
