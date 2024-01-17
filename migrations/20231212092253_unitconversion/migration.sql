create type "IngredientUnit" as enum ('CL', 'DASH', 'PIECE', 'DROPPER_CM', 'DROPPER_DROPS', 'SPRAY', 'GRAMM');

CREATE OR REPLACE FUNCTION convertUnit(inputData text) RETURNS "IngredientUnit" AS
$$
BEGIN
    CASE
        WHEN inputData = 'cl' THEN RETURN 'CL'::"IngredientUnit";
        WHEN inputData = 'Dash' THEN RETURN 'DASH'::"IngredientUnit";
        WHEN inputData = 'Stück' THEN RETURN 'PIECE'::"IngredientUnit";
        WHEN inputData = 'Pip. cm' THEN RETURN 'DROPPER_CM'::"IngredientUnit";
        WHEN inputData = 'Pip. Tropfen' THEN RETURN 'DROPPER_DROPS'::"IngredientUnit";
        WHEN inputData = 'Pin. cm' THEN RETURN 'DROPPER_CM'::"IngredientUnit";
        WHEN inputData = 'Pin. Tropfen' THEN RETURN 'DROPPER_DROPS'::"IngredientUnit";
        WHEN inputData = 'Sprühen' THEN RETURN 'SPRAY'::"IngredientUnit";
        WHEN inputData = 'g' THEN RETURN 'GRAMM'::"IngredientUnit";
        ELSE RETURN NULL::"IngredientUnit"; -- If the unit is not recognized
        END CASE;
END
$$ LANGUAGE plpgsql;

ALTER TABLE "Ingredient"
    ALTER COLUMN "unit" TYPE "IngredientUnit" USING convertUnit("unit");
ALTER TABLE "CocktailRecipeIngredient"
    ALTER COLUMN "unit" TYPE "IngredientUnit" USING convertUnit("unit");

-- CreateTable
CREATE TABLE "CustomIngredientUnitConversion"
(
    "ingredientId" TEXT             NOT NULL,
    "value"        DOUBLE PRECISION NOT NULL,
    "unit"         "IngredientUnit" NOT NULL,

    CONSTRAINT "CustomIngredientUnitConversion_pkey" PRIMARY KEY ("ingredientId", "unit")
);

-- AddForeignKey
ALTER TABLE "CustomIngredientUnitConversion"
    ADD CONSTRAINT "CustomIngredientUnitConversion_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
