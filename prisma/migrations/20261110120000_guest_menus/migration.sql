-- CreateEnum
CREATE TYPE "SignageSlideType" AS ENUM ('IMAGE', 'GUEST_MENU');

-- CreateEnum
CREATE TYPE "Allergen" AS ENUM ('GLUTEN', 'CRUSTACEANS', 'EGGS', 'FISH', 'PEANUTS', 'SOY', 'MILK', 'NUTS', 'CELERY', 'MUSTARD', 'SESAME', 'SULPHITES', 'LUPIN', 'MOLLUSCS');

-- CreateEnum
CREATE TYPE "Additive" AS ENUM ('COLORING', 'PRESERVATIVE', 'ANTIOXIDANT', 'FLAVOR_ENHANCER', 'SULPHURED', 'BLACKENED', 'WAXED', 'PHOSPHATE', 'SWEETENER', 'PHENYLALANINE', 'CAFFEINE', 'QUININE');

-- CreateEnum
CREATE TYPE "GuestMenuInactiveBehavior" AS ENUM ('NOTICE_WITH_LINK', 'NOTICE_WITH_CONTENT', 'REDIRECT');

-- CreateEnum
CREATE TYPE "GuestMenuSourceMode" AS ENUM ('NONE', 'FIXED_CARD', 'ACTIVE_CARD');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkspaceSettingKey" ADD VALUE 'timezone';
ALTER TYPE "WorkspaceSettingKey" ADD VALUE 'currency';
ALTER TYPE "WorkspaceSettingKey" ADD VALUE 'contentLocales';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Permission" ADD VALUE 'GUEST_MENUS_READ';
ALTER TYPE "Permission" ADD VALUE 'GUEST_MENUS_CREATE';
ALTER TYPE "Permission" ADD VALUE 'GUEST_MENUS_UPDATE';
ALTER TYPE "Permission" ADD VALUE 'GUEST_MENUS_DELETE';
ALTER TYPE "Permission" ADD VALUE 'GUEST_MENUS_PUBLISH';
ALTER TYPE "Permission" ADD VALUE 'TRANSLATIONS_READ';
ALTER TYPE "Permission" ADD VALUE 'TRANSLATIONS_UPDATE';
ALTER TYPE "Permission" ADD VALUE 'TAGS_READ';
ALTER TYPE "Permission" ADD VALUE 'TAGS_UPDATE';

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "publicSlug" TEXT;

-- AlterTable
ALTER TABLE "SignageSlide" ADD COLUMN     "guestMenuId" TEXT,
ADD COLUMN     "options" JSONB,
ADD COLUMN     "type" "SignageSlideType" NOT NULL DEFAULT 'IMAGE',
ALTER COLUMN "content" SET DEFAULT '';

-- AlterTable
ALTER TABLE "Garnish" ADD COLUMN     "additives" "Additive"[] DEFAULT ARRAY[]::"Additive"[],
ADD COLUMN     "allergens" "Allergen"[] DEFAULT ARRAY[]::"Allergen"[],
ADD COLUMN     "guestInfoComplete" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CocktailRecipe" ADD COLUMN     "abvOverride" DOUBLE PRECISION,
ADD COLUMN     "extraAdditives" "Additive"[] DEFAULT ARRAY[]::"Additive"[],
ADD COLUMN     "extraAllergens" "Allergen"[] DEFAULT ARRAY[]::"Allergen"[],
ADD COLUMN     "unavailableUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WorkspaceCocktailRecipeStepAction" ADD COLUMN     "dilutionPercent" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "abv" DOUBLE PRECISION,
ADD COLUMN     "additives" "Additive"[] DEFAULT ARRAY[]::"Additive"[],
ADD COLUMN     "allergens" "Allergen"[] DEFAULT ARRAY[]::"Allergen"[],
ADD COLUMN     "guestInfoComplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "guestName" TEXT,
ADD COLUMN     "hideOnGuestMenu" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "GuestMenu" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "validFrom" DATE,
    "validTo" DATE,
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "timeFrom" TEXT,
    "timeTo" TEXT,
    "inactiveBehavior" "GuestMenuInactiveBehavior" NOT NULL DEFAULT 'NOTICE_WITH_LINK',
    "sourceMode" "GuestMenuSourceMode" NOT NULL DEFAULT 'NONE',
    "sourceCardId" TEXT,
    "locales" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "draft" JSONB NOT NULL,
    "published" JSONB,
    "publishedAt" TIMESTAMP(3),
    "previewToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestMenuTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestMenuTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagCategory" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "showAsGuestFilter" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TagCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagDefinition" (
    "workspaceId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "label" JSONB,
    "categoryId" TEXT,
    "color" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TagDefinition_pkey" PRIMARY KEY ("workspaceId","tag")
);

-- CreateTable
CREATE TABLE "CocktailRecipeTranslation" (
    "cocktailId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "history" TEXT,

    CONSTRAINT "CocktailRecipeTranslation_pkey" PRIMARY KEY ("cocktailId","locale")
);

-- CreateTable
CREATE TABLE "IngredientTranslation" (
    "ingredientId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT,
    "guestName" TEXT,
    "description" TEXT,

    CONSTRAINT "IngredientTranslation_pkey" PRIMARY KEY ("ingredientId","locale")
);

-- CreateTable
CREATE TABLE "GarnishTranslation" (
    "garnishId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,

    CONSTRAINT "GarnishTranslation_pkey" PRIMARY KEY ("garnishId","locale")
);

-- CreateTable
CREATE TABLE "GlassTranslation" (
    "glassId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT,

    CONSTRAINT "GlassTranslation_pkey" PRIMARY KEY ("glassId","locale")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestMenu_previewToken_key" ON "GuestMenu"("previewToken");

-- CreateIndex
CREATE INDEX "GuestMenu_workspaceId_idx" ON "GuestMenu"("workspaceId");

-- CreateIndex
CREATE INDEX "GuestMenu_sourceCardId_idx" ON "GuestMenu"("sourceCardId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestMenu_workspaceId_slug_key" ON "GuestMenu"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "GuestMenuTemplate_workspaceId_idx" ON "GuestMenuTemplate"("workspaceId");

-- CreateIndex
CREATE INDEX "TagCategory_workspaceId_idx" ON "TagCategory"("workspaceId");

-- CreateIndex
CREATE INDEX "TagDefinition_categoryId_idx" ON "TagDefinition"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_publicSlug_key" ON "Workspace"("publicSlug");

-- CreateIndex
CREATE INDEX "SignageSlide_guestMenuId_idx" ON "SignageSlide"("guestMenuId");

-- AddForeignKey
ALTER TABLE "SignageSlide" ADD CONSTRAINT "SignageSlide_guestMenuId_fkey" FOREIGN KEY ("guestMenuId") REFERENCES "GuestMenu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestMenu" ADD CONSTRAINT "GuestMenu_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestMenu" ADD CONSTRAINT "GuestMenu_sourceCardId_fkey" FOREIGN KEY ("sourceCardId") REFERENCES "CocktailCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestMenuTemplate" ADD CONSTRAINT "GuestMenuTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagCategory" ADD CONSTRAINT "TagCategory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagDefinition" ADD CONSTRAINT "TagDefinition_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagDefinition" ADD CONSTRAINT "TagDefinition_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TagCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailRecipeTranslation" ADD CONSTRAINT "CocktailRecipeTranslation_cocktailId_fkey" FOREIGN KEY ("cocktailId") REFERENCES "CocktailRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientTranslation" ADD CONSTRAINT "IngredientTranslation_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarnishTranslation" ADD CONSTRAINT "GarnishTranslation_garnishId_fkey" FOREIGN KEY ("garnishId") REFERENCES "Garnish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlassTranslation" ADD CONSTRAINT "GlassTranslation_glassId_fkey" FOREIGN KEY ("glassId") REFERENCES "Glass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
