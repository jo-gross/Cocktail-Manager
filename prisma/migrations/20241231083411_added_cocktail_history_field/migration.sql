-- AlterEnum
ALTER TYPE "Setting" ADD VALUE 'showHistory';

-- AlterTable
ALTER TABLE "CocktailRecipe"
    ADD COLUMN "history" TEXT;
