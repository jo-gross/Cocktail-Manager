-- AlterEnum
ALTER TYPE "Setting" ADD VALUE 'showFastQueueCheck';

-- AlterTable
ALTER TABLE "CocktailQueue"
    ADD COLUMN "inProgress" BOOLEAN NOT NULL DEFAULT false;
