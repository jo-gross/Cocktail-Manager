-- CreateTable
CREATE TABLE "CocktailCalculation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,

    CONSTRAINT "CocktailCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CocktailCalculationItems" (
    "plannedAmount" INTEGER NOT NULL,
    "customPrice" DOUBLE PRECISION,
    "cocktailId" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,

    CONSTRAINT "CocktailCalculationItems_pkey" PRIMARY KEY ("calculationId","cocktailId")
);

-- AddForeignKey
ALTER TABLE "CocktailCalculation" ADD CONSTRAINT "CocktailCalculation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailCalculation" ADD CONSTRAINT "CocktailCalculation_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailCalculationItems" ADD CONSTRAINT "CocktailCalculationItems_cocktailId_fkey" FOREIGN KEY ("cocktailId") REFERENCES "CocktailRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailCalculationItems" ADD CONSTRAINT "CocktailCalculationItems_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "CocktailCalculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
