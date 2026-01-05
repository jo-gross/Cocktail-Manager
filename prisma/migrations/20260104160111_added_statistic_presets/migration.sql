-- CreateEnum
CREATE TYPE "SavedSetType" AS ENUM ('TAG_SET', 'INGREDIENT_SET', 'COCKTAIL_SET');

-- CreateEnum
CREATE TYPE "SavedSetLogic" AS ENUM ('AND', 'OR');

-- AlterEnum
ALTER TYPE "WorkspaceSettingKey" ADD VALUE 'statisticDayStartTime';

-- CreateTable
CREATE TABLE "StatisticSavedSet" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SavedSetType" NOT NULL,
    "logic" "SavedSetLogic",
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatisticSavedSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatisticSavedSet_workspaceId_idx" ON "StatisticSavedSet"("workspaceId");

-- CreateIndex
CREATE INDEX "StatisticSavedSet_workspaceId_type_idx" ON "StatisticSavedSet"("workspaceId", "type");

-- AddForeignKey
ALTER TABLE "StatisticSavedSet" ADD CONSTRAINT "StatisticSavedSet_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
