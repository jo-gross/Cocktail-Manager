-- AlterEnum
ALTER TYPE "Setting" ADD VALUE 'showStatisticActions';

-- CreateTable
CREATE TABLE "CocktailStatisticItem"
(
    "id"             TEXT         NOT NULL,
    "cocktailId"     TEXT         NOT NULL,
    "userId"         TEXT         NOT NULL,
    "workspaceId"    TEXT         NOT NULL,
    "date"           TIMESTAMP(3) NOT NULL,
    "cocktailCardId" TEXT,
    "actionSource"   TEXT,

    CONSTRAINT "CocktailStatisticItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CocktailStatisticItem"
    ADD CONSTRAINT "CocktailStatisticItem_cocktailId_fkey" FOREIGN KEY ("cocktailId") REFERENCES "CocktailRecipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailStatisticItem"
    ADD CONSTRAINT "CocktailStatisticItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailStatisticItem"
    ADD CONSTRAINT "CocktailStatisticItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailStatisticItem"
    ADD CONSTRAINT "CocktailStatisticItem_cocktailCardId_fkey" FOREIGN KEY ("cocktailCardId") REFERENCES "CocktailCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
