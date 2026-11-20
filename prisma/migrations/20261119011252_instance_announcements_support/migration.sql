-- CreateTable
CREATE TABLE "InstanceAnnouncement" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "title" JSONB,
    "body" JSONB NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "workspaceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstanceAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstanceAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "actor" TEXT,
    "reason" TEXT,
    "idempotencyKey" TEXT,
    "requestHash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstanceAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstanceAnnouncement_endsAt_idx" ON "InstanceAnnouncement"("endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "InstanceAuditLog_idempotencyKey_key" ON "InstanceAuditLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "InstanceAuditLog_targetType_targetId_idx" ON "InstanceAuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "InstanceAuditLog_createdAt_idx" ON "InstanceAuditLog"("createdAt");
