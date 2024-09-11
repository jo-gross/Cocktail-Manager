-- CreateTable
CREATE TABLE "CocktailRating"
(
    "id"         TEXT         NOT NULL,
    "cocktailId" TEXT         NOT NULL,
    "name"       TEXT,
    "rating"     INTEGER      NOT NULL DEFAULT 0,
    "comment"    TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CocktailRating_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CocktailRating"
    ADD CONSTRAINT "CocktailRating_cocktailId_fkey" FOREIGN KEY ("cocktailId") REFERENCES "CocktailRecipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
