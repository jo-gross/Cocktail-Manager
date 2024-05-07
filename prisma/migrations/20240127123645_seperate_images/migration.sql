-- CreateTable
CREATE TABLE "GlassImage"
(
    "image"   TEXT NOT NULL,
    "glassId" TEXT NOT NULL,

    CONSTRAINT "GlassImage_pkey" PRIMARY KEY ("glassId")
);

-- CreateTable
CREATE TABLE "CocktailRecipeImage"
(
    "image"            TEXT NOT NULL,
    "cocktailRecipeId" TEXT NOT NULL,

    CONSTRAINT "CocktailRecipeImage_pkey" PRIMARY KEY ("cocktailRecipeId")
);

-- CreateTable
CREATE TABLE "IngredientImage"
(
    "image"        TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,

    CONSTRAINT "IngredientImage_pkey" PRIMARY KEY ("ingredientId")
);

-- CreateTable
CREATE TABLE "GarnishImage"
(
    "image"     TEXT NOT NULL,
    "garnishId" TEXT NOT NULL,

    CONSTRAINT "GarnishImage_pkey" PRIMARY KEY ("garnishId")
);

-- AddForeignKey
ALTER TABLE "GlassImage"
    ADD CONSTRAINT "GlassImage_glassId_fkey" FOREIGN KEY ("glassId") REFERENCES "Glass" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailRecipeImage"
    ADD CONSTRAINT "CocktailRecipeImage_cocktailRecipeId_fkey" FOREIGN KEY ("cocktailRecipeId") REFERENCES "CocktailRecipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientImage"
    ADD CONSTRAINT "IngredientImage_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GarnishImage"
    ADD CONSTRAINT "GarnishImage_garnishId_fkey" FOREIGN KEY ("garnishId") REFERENCES "Garnish" ("id") ON DELETE CASCADE ON UPDATE CASCADE;


DO
$$
    DECLARE
        cocktail_id    TEXT;
        cocktail_image TEXT;
    BEGIN
        FOR cocktail_id, cocktail_image IN SELECT id, image FROM "CocktailRecipe" WHERE image IS NOT NULL
            LOOP
                INSERT INTO "CocktailRecipeImage" ("image", "cocktailRecipeId")
                VALUES (cocktail_image, cocktail_id);
            END LOOP;
    END
$$;


DO
$$
    DECLARE
        glass_id    TEXT;
        glass_image TEXT;
    BEGIN
        FOR glass_id, glass_image IN SELECT id, image FROM "Glass" WHERE image IS NOT NULL
            LOOP
                INSERT INTO "GlassImage" ("image", "glassId")
                VALUES (glass_image, glass_id);
            END LOOP;
    END
$$;


DO
$$
    DECLARE
        ingredient_id    TEXT;
        ingredient_image TEXT;
    BEGIN
        FOR ingredient_id, ingredient_image IN SELECT id, image FROM "Ingredient" WHERE image IS NOT NULL
            LOOP
                INSERT INTO "IngredientImage" ("image", "ingredientId")
                VALUES (ingredient_image, ingredient_id);
            END LOOP;
    END
$$;

DO
$$
    DECLARE
        garnish_id    TEXT;
        garnish_image TEXT;
    BEGIN
        FOR garnish_id, garnish_image IN SELECT id, image FROM "Garnish" WHERE image IS NOT NULL
            LOOP
                INSERT INTO "GarnishImage" ("image", "garnishId")
                VALUES (garnish_image, garnish_id);
            END LOOP;
    END
$$;


-- AlterTable
ALTER TABLE "CocktailRecipe"
    DROP COLUMN "image";

-- AlterTable
ALTER TABLE "Glass"
    DROP COLUMN "image";

-- AlterTable
ALTER TABLE "Ingredient"
    DROP COLUMN "image";

-- AlterTable
ALTER TABLE "Garnish"
    DROP COLUMN "image";
