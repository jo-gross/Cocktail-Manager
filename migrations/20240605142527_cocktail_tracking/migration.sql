-- CreateTable
CREATE TABLE "CocktailQueue"
(
    "id"          TEXT         NOT NULL,
    "cocktailId"  TEXT         NOT NULL,
    "workspaceId" TEXT         NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CocktailQueue_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CocktailQueue"
    ADD CONSTRAINT "CocktailQueue_cocktailId_fkey" FOREIGN KEY ("cocktailId") REFERENCES "CocktailRecipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailQueue"
    ADD CONSTRAINT "CocktailQueue_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
