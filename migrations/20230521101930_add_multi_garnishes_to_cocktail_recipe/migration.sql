/*
  Warnings:

  - You are about to drop the column `garnishId` on the `CocktailRecipe` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "CocktailRecipe"
    DROP CONSTRAINT "CocktailRecipe_garnishId_fkey";

-- CreateTable
CREATE TABLE "CocktailRecipeGarnish"
(
    "cocktailRecipeId" TEXT    NOT NULL,
    "garnishId"        TEXT    NOT NULL,

    description        TEXT    NULL,
    "garnishNumber"    INTEGER NOT NULL,
    optional          BOOLEAN NOT NULL default false,
    CONSTRAINT "CocktailRecipeGarnish_pkey" PRIMARY KEY ("garnishId", "cocktailRecipeId")
);

-- AddForeignKey
ALTER TABLE "CocktailRecipeGarnish"
    ADD CONSTRAINT "CocktailRecipeGarnish_cocktailRecipeId_fkey" FOREIGN KEY ("cocktailRecipeId") REFERENCES "CocktailRecipe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailRecipeGarnish"
    ADD CONSTRAINT "CocktailRecipeGarnish_garnishId_fkey" FOREIGN KEY ("garnishId") REFERENCES "Garnish" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "CocktailRecipeGarnish" ("cocktailRecipeId", "garnishId", "garnishNumber")
SELECT "id", "garnishId", 0
FROM "CocktailRecipe";
ALTER TABLE "CocktailRecipe"
    DROP COLUMN "garnishId";
