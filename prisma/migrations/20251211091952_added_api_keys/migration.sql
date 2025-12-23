-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('COCKTAILS_READ', 'COCKTAILS_CREATE', 'COCKTAILS_UPDATE', 'COCKTAILS_DELETE', 'INGREDIENTS_READ', 'INGREDIENTS_CREATE', 'INGREDIENTS_UPDATE', 'INGREDIENTS_DELETE', 'GARNISHES_READ', 'GARNISHES_CREATE', 'GARNISHES_UPDATE', 'GARNISHES_DELETE', 'GLASSES_READ', 'GLASSES_CREATE', 'GLASSES_UPDATE', 'GLASSES_DELETE', 'UNITS_READ', 'UNITS_UPDATE', 'QUEUE_READ', 'QUEUE_CREATE', 'QUEUE_UPDATE', 'QUEUE_DELETE', 'STATISTICS_READ', 'STATISTICS_CREATE', 'STATISTICS_DELETE', 'CARDS_READ', 'CARDS_CREATE', 'CARDS_UPDATE', 'CARDS_DELETE', 'CALCULATIONS_READ', 'CALCULATIONS_CREATE', 'CALCULATIONS_UPDATE', 'CALCULATIONS_DELETE', 'WORKSPACE_READ', 'WORKSPACE_UPDATE', 'USERS_READ', 'USERS_UPDATE', 'USERS_DELETE', 'ICE_READ', 'ICE_CREATE', 'ICE_UPDATE', 'ICE_DELETE', 'RATINGS_READ', 'RATINGS_CREATE', 'RATINGS_DELETE');

-- CreateTable
CREATE TABLE "WorkspaceApiKey" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "WorkspaceApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKeyPermission" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "permission" "Permission" NOT NULL,

    CONSTRAINT "ApiKeyPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceApiKey_keyId_key" ON "WorkspaceApiKey"("keyId");

-- CreateIndex
CREATE INDEX "WorkspaceApiKey_workspaceId_idx" ON "WorkspaceApiKey"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceApiKey_keyId_idx" ON "WorkspaceApiKey"("keyId");

-- CreateIndex
CREATE INDEX "WorkspaceApiKey_revoked_idx" ON "WorkspaceApiKey"("revoked");

-- CreateIndex
CREATE INDEX "ApiKeyPermission_apiKeyId_idx" ON "ApiKeyPermission"("apiKeyId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyPermission_apiKeyId_permission_key" ON "ApiKeyPermission"("apiKeyId", "permission");

-- AddForeignKey
ALTER TABLE "WorkspaceApiKey" ADD CONSTRAINT "WorkspaceApiKey_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceApiKey" ADD CONSTRAINT "WorkspaceApiKey_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyPermission" ADD CONSTRAINT "ApiKeyPermission_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "WorkspaceApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
