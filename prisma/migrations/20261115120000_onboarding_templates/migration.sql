-- Onboarding & templates (docs/plans/ONBOARDING-PLAN.md).
-- Existing workspaces count as set up; only new ones go through the setup assistant.
-- Existing users are not offered the welcome tour (they find the tours on the help page).

-- CreateEnum
CREATE TYPE "GuideStatus" AS ENUM ('STARTED', 'COMPLETED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "TemplateKind" AS ENUM ('BASE', 'CATALOG', 'DEMO');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "setupCompletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserGuideProgress" (
    "userId" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "GuideStatus" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGuideProgress_pkey" PRIMARY KEY ("userId","guideId")
);

-- CreateTable
CREATE TABLE "WorkspaceTemplate" (
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "TemplateKind" NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "locales" TEXT[],
    "source" TEXT,
    "builtIn" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceTemplate_pkey" PRIMARY KEY ("workspaceId")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceTemplate_key_key" ON "WorkspaceTemplate"("key");

-- AddForeignKey
ALTER TABLE "UserGuideProgress" ADD CONSTRAINT "UserGuideProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceTemplate" ADD CONSTRAINT "WorkspaceTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill
UPDATE "Workspace" SET "setupCompletedAt" = now();

INSERT INTO "UserGuideProgress" ("userId", "guideId", "version", "status", "updatedAt")
SELECT "id", 'tour:basics-bar', 1, 'DISMISSED', now() FROM "User"
ON CONFLICT DO NOTHING;
