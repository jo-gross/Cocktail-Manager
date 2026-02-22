-- CreateTable
CREATE TABLE "CocktailCalculationGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefaultExpanded" BOOLEAN NOT NULL DEFAULT false,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CocktailCalculationGroup_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CocktailCalculation"
    ADD COLUMN "groupId" TEXT;

-- CreateIndex
CREATE INDEX "CocktailCalculationGroup_workspaceId_idx" ON "CocktailCalculationGroup"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CocktailCalculationGroup_workspaceId_name_key" ON "CocktailCalculationGroup"("workspaceId", "name");

-- AddForeignKey
ALTER TABLE "CocktailCalculationGroup" ADD CONSTRAINT "CocktailCalculationGroup_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailCalculation" ADD CONSTRAINT "CocktailCalculation_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "CocktailCalculationGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
