-- AlterTable
ALTER TABLE "Workspace"
    ADD COLUMN "demoUserId" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;
