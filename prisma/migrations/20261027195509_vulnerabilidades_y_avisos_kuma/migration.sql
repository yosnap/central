-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "auditError" TEXT,
ADD COLUMN     "auditedAt" TIMESTAMP(3),
ADD COLUMN     "kumaPushId" INTEGER,
ADD COLUMN     "kumaPushToken" TEXT;

-- AlterTable
ALTER TABLE "Server" ADD COLUMN     "kumaPushId" INTEGER,
ADD COLUMN     "kumaPushToken" TEXT;

-- CreateTable
CREATE TABLE "ProjectAdvisory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "advisoryId" TEXT NOT NULL,
    "package" TEXT NOT NULL,
    "ecosystem" TEXT NOT NULL,
    "installed" TEXT NOT NULL,
    "fixedIn" TEXT,
    "severity" TEXT NOT NULL,
    "summary" TEXT,
    "url" TEXT,
    "dev" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "ignoredAt" TIMESTAMP(3),

    CONSTRAINT "ProjectAdvisory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectAdvisory_projectId_resolvedAt_idx" ON "ProjectAdvisory"("projectId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAdvisory_projectId_advisoryId_package_installed_key" ON "ProjectAdvisory"("projectId", "advisoryId", "package", "installed");

-- AddForeignKey
ALTER TABLE "ProjectAdvisory" ADD CONSTRAINT "ProjectAdvisory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
