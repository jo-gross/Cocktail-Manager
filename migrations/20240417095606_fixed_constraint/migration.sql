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
ALTER TABLE "CalculationIngredientShoppingUnit"
    ADD CONSTRAINT "CalculationIngredientShoppingUnit_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationIngredientShoppingUnit"
    ADD CONSTRAINT "CalculationIngredientShoppingUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationIngredientShoppingUnit"
    ADD CONSTRAINT "CalculationIngredientShoppingUnit_cocktailCalculationId_fkey" FOREIGN KEY ("cocktailCalculationId") REFERENCES "CocktailCalculation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
