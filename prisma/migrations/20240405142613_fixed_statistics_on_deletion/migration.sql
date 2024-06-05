-- DropForeignKey
ALTER TABLE "CocktailStatisticItem"
    DROP CONSTRAINT "CocktailStatisticItem_cocktailCardId_fkey";

-- DropForeignKey
ALTER TABLE "CocktailStatisticItem"
    DROP CONSTRAINT "CocktailStatisticItem_userId_fkey";

-- AlterTable
ALTER TABLE "CocktailStatisticItem"
    ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CocktailStatisticItem"
    ADD CONSTRAINT "CocktailStatisticItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailStatisticItem"
    ADD CONSTRAINT "CocktailStatisticItem_cocktailCardId_fkey" FOREIGN KEY ("cocktailCardId") REFERENCES "CocktailCard" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
