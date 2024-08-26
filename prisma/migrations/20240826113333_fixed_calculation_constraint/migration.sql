-- DropForeignKey
ALTER TABLE "CalculationIngredientShoppingUnit"
    DROP CONSTRAINT "CalculationIngredientShoppingUnit_cocktailCalculationId_fkey";

-- AddForeignKey
ALTER TABLE "CalculationIngredientShoppingUnit"
    ADD CONSTRAINT "CalculationIngredientShoppingUnit_cocktailCalculationId_fkey" FOREIGN KEY ("cocktailCalculationId") REFERENCES "CocktailCalculation" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
