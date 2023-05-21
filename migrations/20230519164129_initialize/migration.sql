-- CreateTable
CREATE TABLE "Glass" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "volume" DOUBLE PRECISION,
    "image" TEXT,
    "deposit" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Glass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decoration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "image" TEXT,

    CONSTRAINT "Decoration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CocktailRecipe" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[],
    "image" TEXT,
    "price" DOUBLE PRECISION,
    "glassWithIce" TEXT NOT NULL,
    "glassId" TEXT,
    "decorationId" TEXT,

    CONSTRAINT "CocktailRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CocktailRecipeStep" (
    "id" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "mixing" BOOLEAN NOT NULL,
    "tool" TEXT NOT NULL,
    "cocktailRecipeId" TEXT NOT NULL,

    CONSTRAINT "CocktailRecipeStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CocktailRecipeIngredient" (
    "id" TEXT NOT NULL,
    "ingredientNumber" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION,
    "unit" TEXT,
    "ingredientId" TEXT,
    "cocktailRecipeStepId" TEXT NOT NULL,

    CONSTRAINT "CocktailRecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "price" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION,
    "unit" TEXT,
    "link" TEXT,
    "image" TEXT,
    "tags" TEXT[],

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CocktailCard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3),

    CONSTRAINT "CocktailCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CocktailCardGroup" (
    "id" TEXT NOT NULL,
    "groupNumber" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "cocktailCardId" TEXT NOT NULL,
    "groupPrice" DOUBLE PRECISION,

    CONSTRAINT "CocktailCardGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CocktailCardGroupItem" (
    "itemNumber" SERIAL NOT NULL,
    "cocktailCardGroupId" TEXT NOT NULL,
    "cocktailId" TEXT NOT NULL,
    "specialPrice" DOUBLE PRECISION,

    CONSTRAINT "CocktailCardGroupItem_pkey" PRIMARY KEY ("cocktailCardGroupId","cocktailId")
);

-- AddForeignKey
ALTER TABLE "CocktailRecipe" ADD CONSTRAINT "CocktailRecipe_glassId_fkey" FOREIGN KEY ("glassId") REFERENCES "Glass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailRecipe" ADD CONSTRAINT "CocktailRecipe_decorationId_fkey" FOREIGN KEY ("decorationId") REFERENCES "Decoration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailRecipeStep" ADD CONSTRAINT "CocktailRecipeStep_cocktailRecipeId_fkey" FOREIGN KEY ("cocktailRecipeId") REFERENCES "CocktailRecipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailRecipeIngredient" ADD CONSTRAINT "CocktailRecipeIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailRecipeIngredient" ADD CONSTRAINT "CocktailRecipeIngredient_cocktailRecipeStepId_fkey" FOREIGN KEY ("cocktailRecipeStepId") REFERENCES "CocktailRecipeStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailCardGroup" ADD CONSTRAINT "CocktailCardGroup_cocktailCardId_fkey" FOREIGN KEY ("cocktailCardId") REFERENCES "CocktailCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailCardGroupItem" ADD CONSTRAINT "CocktailCardGroupItem_cocktailCardGroupId_fkey" FOREIGN KEY ("cocktailCardGroupId") REFERENCES "CocktailCardGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailCardGroupItem" ADD CONSTRAINT "CocktailCardGroupItem_cocktailId_fkey" FOREIGN KEY ("cocktailId") REFERENCES "CocktailRecipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
