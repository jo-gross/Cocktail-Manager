/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `WorkspaceCocktailRecipeStepAction` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "CocktailRecipeStep"
    DROP CONSTRAINT "CocktailRecipeStep_actionId_fkey";

-- AddForeignKey
ALTER TABLE "CocktailRecipeStep"
    ADD CONSTRAINT "CocktailRecipeStep_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "WorkspaceCocktailRecipeStepAction" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
