-- CreateEnum
CREATE TYPE "Setting" AS ENUM ('showImage', 'showImageSide', 'showTags', 'lessItems', 'theme');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'USER');

-- CreateTable
CREATE TABLE "Account"
(
    "id"                  TEXT NOT NULL,
    "user_id"             TEXT NOT NULL,
    "type"                TEXT NOT NULL,
    "provider"            TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token"       TEXT,
    "access_token"        TEXT,
    "expires_at"          INTEGER,
    "token_type"          TEXT,
    "scope"               TEXT,
    "id_token"            TEXT,
    "session_state"       TEXT,
    "oauth_token_secret"  TEXT,
    "oauth_token"         TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session"
(
    "id"            TEXT         NOT NULL,
    "session_token" TEXT         NOT NULL,
    "user_id"       TEXT         NOT NULL,
    "expires"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User"
(
    "id"            TEXT NOT NULL,
    "name"          TEXT,
    "email"         TEXT,
    "emailVerified" TIMESTAMP(3),
    "image"         TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSetting"
(
    "userId"  TEXT      NOT NULL,
    "setting" "Setting" NOT NULL,
    "value"   TEXT,

    CONSTRAINT "UserSetting_pkey" PRIMARY KEY ("userId", "setting")
);

-- CreateTable
CREATE TABLE "VerificationToken"
(
    "id"         SERIAL       NOT NULL,
    "identifier" TEXT         NOT NULL,
    "token"      TEXT         NOT NULL,
    "expires"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceUser"
(
    "workspaceId" TEXT   NOT NULL,
    "userId"      TEXT   NOT NULL,
    "role"        "Role" NOT NULL,

    CONSTRAINT "WorkspaceUser_pkey" PRIMARY KEY ("workspaceId", "userId")
);

-- CreateTable
CREATE TABLE "Workspace"
(
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "image"       TEXT,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Glass"
(
    "id"          TEXT             NOT NULL,
    "name"        TEXT             NOT NULL,
    "volume"      DOUBLE PRECISION,
    "image"       TEXT,
    "deposit"     DOUBLE PRECISION NOT NULL,
    "workspaceId" TEXT             NOT NULL,

    CONSTRAINT "Glass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Garnish"
(
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "price"       DOUBLE PRECISION,
    "image"       TEXT,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "Garnish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CocktailRecipe"
(
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "description"  TEXT,
    "tags"         TEXT[],
    "image"        TEXT,
    "price"        DOUBLE PRECISION,
    "glassWithIce" TEXT NOT NULL,
    "glassId"      TEXT,
    "workspaceId"  TEXT NOT NULL,

    CONSTRAINT "CocktailRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CocktailRecipeGarnish"
(
    "cocktailRecipeId" TEXT    NOT NULL,
    "garnishId"        TEXT    NOT NULL,
    "description"      TEXT,
    "garnishNumber"    INTEGER NOT NULL,
    "optional"         BOOLEAN DEFAULT false,

    CONSTRAINT "CocktailRecipeGarnish_pkey" PRIMARY KEY ("garnishId", "cocktailRecipeId")
);

-- CreateTable
CREATE TABLE "CocktailRecipeStep"
(
    "id"               TEXT    NOT NULL,
    "stepNumber"       INTEGER NOT NULL,
    "mixing"           BOOLEAN NOT NULL,
    "tool"             TEXT    NOT NULL,
    "cocktailRecipeId" TEXT    NOT NULL,

    CONSTRAINT "CocktailRecipeStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CocktailRecipeIngredient"
(
    "id"                   TEXT    NOT NULL,
    "ingredientNumber"     INTEGER NOT NULL,
    "amount"               DOUBLE PRECISION,
    "unit"                 TEXT,
    "ingredientId"         TEXT,
    "cocktailRecipeStepId" TEXT    NOT NULL,

    CONSTRAINT "CocktailRecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient"
(
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "shortName"   TEXT,
    "price"       DOUBLE PRECISION,
    "volume"      DOUBLE PRECISION,
    "unit"        TEXT,
    "link"        TEXT,
    "image"       TEXT,
    "tags"        TEXT[],
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CocktailCard"
(
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "date"        TIMESTAMP(3),
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "CocktailCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CocktailCardGroup"
(
    "id"             TEXT   NOT NULL,
    "groupNumber"    SERIAL NOT NULL,
    "name"           TEXT   NOT NULL,
    "cocktailCardId" TEXT   NOT NULL,
    "groupPrice"     DOUBLE PRECISION,

    CONSTRAINT "CocktailCardGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CocktailCardGroupItem"
(
    "itemNumber"          SERIAL NOT NULL,
    "cocktailCardGroupId" TEXT   NOT NULL,
    "cocktailId"          TEXT   NOT NULL,
    "specialPrice"        DOUBLE PRECISION,

    CONSTRAINT "CocktailCardGroupItem_pkey" PRIMARY KEY ("cocktailCardGroupId", "cocktailId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_provider_account_id_key" ON "Account" ("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "Session_session_token_key" ON "Session" ("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User" ("email");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken" ("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken" ("identifier", "token");

-- AddForeignKey
ALTER TABLE "Account"
    ADD CONSTRAINT "Account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session"
    ADD CONSTRAINT "Session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSetting"
    ADD CONSTRAINT "UserSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceUser"
    ADD CONSTRAINT "WorkspaceUser_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceUser"
    ADD CONSTRAINT "WorkspaceUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Glass"
    ADD CONSTRAINT "Glass_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Garnish"
    ADD CONSTRAINT "Garnish_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailRecipe"
    ADD CONSTRAINT "CocktailRecipe_glassId_fkey" FOREIGN KEY ("glassId") REFERENCES "Glass" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailRecipe"
    ADD CONSTRAINT "CocktailRecipe_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailRecipeGarnish"
    ADD CONSTRAINT "CocktailRecipeGarnish_cocktailRecipeId_fkey" FOREIGN KEY ("cocktailRecipeId") REFERENCES "CocktailRecipe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailRecipeGarnish"
    ADD CONSTRAINT "CocktailRecipeGarnish_garnishId_fkey" FOREIGN KEY ("garnishId") REFERENCES "Garnish" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailRecipeStep"
    ADD CONSTRAINT "CocktailRecipeStep_cocktailRecipeId_fkey" FOREIGN KEY ("cocktailRecipeId") REFERENCES "CocktailRecipe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailRecipeIngredient"
    ADD CONSTRAINT "CocktailRecipeIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailRecipeIngredient"
    ADD CONSTRAINT "CocktailRecipeIngredient_cocktailRecipeStepId_fkey" FOREIGN KEY ("cocktailRecipeStepId") REFERENCES "CocktailRecipeStep" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient"
    ADD CONSTRAINT "Ingredient_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailCard"
    ADD CONSTRAINT "CocktailCard_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailCardGroup"
    ADD CONSTRAINT "CocktailCardGroup_cocktailCardId_fkey" FOREIGN KEY ("cocktailCardId") REFERENCES "CocktailCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailCardGroupItem"
    ADD CONSTRAINT "CocktailCardGroupItem_cocktailCardGroupId_fkey" FOREIGN KEY ("cocktailCardGroupId") REFERENCES "CocktailCardGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailCardGroupItem"
    ADD CONSTRAINT "CocktailCardGroupItem_cocktailId_fkey" FOREIGN KEY ("cocktailId") REFERENCES "CocktailRecipe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
