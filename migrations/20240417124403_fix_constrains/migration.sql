-- DropForeignKey
ALTER TABLE "CocktailCalculation"
    DROP CONSTRAINT "CocktailCalculation_updatedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "CocktailCalculation"
    DROP CONSTRAINT "CocktailCalculation_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "CocktailCardGroup"
    DROP CONSTRAINT "CocktailCardGroup_cocktailCardId_fkey";

-- DropForeignKey
ALTER TABLE "CocktailCardGroupItem"
    DROP CONSTRAINT "CocktailCardGroupItem_cocktailCardGroupId_fkey";

-- DropForeignKey
ALTER TABLE "CocktailCardGroupItem"
    DROP CONSTRAINT "CocktailCardGroupItem_cocktailId_fkey";

-- DropForeignKey
ALTER TABLE "CocktailRecipeGarnish"
    DROP CONSTRAINT "CocktailRecipeGarnish_cocktailRecipeId_fkey";

-- DropForeignKey
ALTER TABLE "CocktailRecipeGarnish"
    DROP CONSTRAINT "CocktailRecipeGarnish_garnishId_fkey";

-- DropForeignKey
ALTER TABLE "CocktailRecipeIngredient"
    DROP CONSTRAINT "CocktailRecipeIngredient_cocktailRecipeStepId_fkey";

-- DropForeignKey
ALTER TABLE "CocktailRecipeIngredient"
    DROP CONSTRAINT "CocktailRecipeIngredient_ingredientId_fkey";

-- DropForeignKey
ALTER TABLE "CocktailRecipeStep"
    DROP CONSTRAINT "CocktailRecipeStep_cocktailRecipeId_fkey";

-- DropIndex
DROP INDEX "WorkspaceCocktailRecipeStepAction_name_key";

-- CreateTable
CREATE TABLE "CalculationIngredientShoppingUnit"
(
    "ingredientId"          TEXT NOT NULL,
    "unitId"                TEXT NOT NULL,
    "cocktailCalculationId" TEXT NOT NULL,

    CONSTRAINT "CalculationIngredientShoppingUnit_pkey" PRIMARY KEY ("ingredientId", "unitId", "cocktailCalculationId")
);

-- AddForeignKey
ALTER TABLE "CocktailRecipeGarnish"
    ADD CONSTRAINT "CocktailRecipeGarnish_cocktailRecipeId_fkey" FOREIGN KEY ("cocktailRecipeId") REFERENCES "CocktailRecipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailRecipeGarnish"
    ADD CONSTRAINT "CocktailRecipeGarnish_garnishId_fkey" FOREIGN KEY ("garnishId") REFERENCES "Garnish" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailRecipeStep"
    ADD CONSTRAINT "CocktailRecipeStep_cocktailRecipeId_fkey" FOREIGN KEY ("cocktailRecipeId") REFERENCES "CocktailRecipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailRecipeIngredient"
    ADD CONSTRAINT "CocktailRecipeIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailRecipeIngredient"
    ADD CONSTRAINT "CocktailRecipeIngredient_cocktailRecipeStepId_fkey" FOREIGN KEY ("cocktailRecipeStepId") REFERENCES "CocktailRecipeStep" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailCardGroup"
    ADD CONSTRAINT "CocktailCardGroup_cocktailCardId_fkey" FOREIGN KEY ("cocktailCardId") REFERENCES "CocktailCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailCardGroupItem"
    ADD CONSTRAINT "CocktailCardGroupItem_cocktailCardGroupId_fkey" FOREIGN KEY ("cocktailCardGroupId") REFERENCES "CocktailCardGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailCardGroupItem"
    ADD CONSTRAINT "CocktailCardGroupItem_cocktailId_fkey" FOREIGN KEY ("cocktailId") REFERENCES "CocktailRecipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailCalculation"
    ADD CONSTRAINT "CocktailCalculation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailCalculation"
    ADD CONSTRAINT "CocktailCalculation_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationIngredientShoppingUnit"
    ADD CONSTRAINT "CalculationIngredientShoppingUnit_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationIngredientShoppingUnit"
    ADD CONSTRAINT "CalculationIngredientShoppingUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationIngredientShoppingUnit"
    ADD CONSTRAINT "CalculationIngredientShoppingUnit_cocktailCalculationId_fkey" FOREIGN KEY ("cocktailCalculationId") REFERENCES "CocktailCalculation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
