-- Hardening (docs/BACKEND-CONVENTIONS.md):
-- 1. Remove cross-workspace references that the former IDOR bugs could create.
-- 2. Indexes for queue consumption and statistics ranges.
-- 3. Unit conversion factors must be positive (NOT VALID: existing rows are not re-checked).
-- Deleting in-use glasses/ingredients is prevented in the application under a row
-- lock (see deleteGlass/deleteIngredient); a NO ACTION FK would break workspace
-- cascades because Postgres checks it before the deeper cascade levels run.

-- 1. Cross-workspace references
UPDATE "CocktailRecipe" c SET "glassId" = NULL
FROM "Glass" g WHERE c."glassId" = g."id" AND g."workspaceId" <> c."workspaceId";

UPDATE "CocktailRecipe" c SET "iceId" = NULL
FROM "Ice" i WHERE c."iceId" = i."id" AND i."workspaceId" <> c."workspaceId";

UPDATE "CocktailRecipeIngredient" ri SET "ingredientId" = NULL
FROM "CocktailRecipeStep" s, "CocktailRecipe" c, "Ingredient" ing
WHERE ri."cocktailRecipeStepId" = s."id" AND s."cocktailRecipeId" = c."id"
  AND ri."ingredientId" = ing."id" AND ing."workspaceId" <> c."workspaceId";

UPDATE "CocktailRecipeIngredient" ri SET "unitId" = NULL
FROM "CocktailRecipeStep" s, "CocktailRecipe" c, "Unit" u
WHERE ri."cocktailRecipeStepId" = s."id" AND s."cocktailRecipeId" = c."id"
  AND ri."unitId" = u."id" AND u."workspaceId" <> c."workspaceId";

-- 2. Indexes
CREATE INDEX "CocktailQueue_workspaceId_cocktailId_createdAt_idx" ON "CocktailQueue"("workspaceId", "cocktailId", "createdAt");
CREATE INDEX "CocktailStatisticItem_workspaceId_date_idx" ON "CocktailStatisticItem"("workspaceId", "date");

-- 3. Positive conversion factors
ALTER TABLE "UnitConversion" ADD CONSTRAINT "UnitConversion_factor_positive" CHECK ("factor" > 0) NOT VALID;
