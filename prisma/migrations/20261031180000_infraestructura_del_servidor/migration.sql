-- AlterTable
ALTER TABLE "ServerContainer" ADD COLUMN "infra" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Website" ADD COLUMN "serverId" TEXT;

-- AddForeignKey
ALTER TABLE "Website" ADD CONSTRAINT "Website_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE SET NULL ON UPDATE CASCADE;
