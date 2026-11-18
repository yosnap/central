-- CreateTable
CREATE TABLE "ApiChange" (
    "id" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "keyName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiChange_entity_entityId_idx" ON "ApiChange"("entity", "entityId");

-- CreateIndex
CREATE INDEX "ApiChange_createdAt_idx" ON "ApiChange"("createdAt");
