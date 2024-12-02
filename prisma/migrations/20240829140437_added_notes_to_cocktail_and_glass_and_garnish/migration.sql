-- AlterEnum
ALTER TYPE "Setting" ADD VALUE 'showNotes';

-- AlterTable
ALTER TABLE "CocktailRecipe"
    ADD COLUMN "notes" TEXT;

-- AlterTable
ALTER TABLE "Garnish"
    ADD COLUMN "notes" TEXT;

-- AlterTable
ALTER TABLE "Glass"
    ADD COLUMN "notes" TEXT;
