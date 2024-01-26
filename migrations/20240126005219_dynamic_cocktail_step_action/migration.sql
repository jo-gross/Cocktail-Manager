-- CreateEnum
CREATE TYPE "WorkspaceSettingKey" AS ENUM ('translations', 'usePrices');

-- CreateTable
CREATE TABLE "WorkspaceSetting"
(
    "workspaceId" TEXT                  NOT NULL,
    "setting"     "WorkspaceSettingKey" NOT NULL,
    "value"       TEXT,

    CONSTRAINT "WorkspaceSetting_pkey" PRIMARY KEY ("workspaceId", "setting")
);

-- AddForeignKey
ALTER TABLE "WorkspaceSetting"
    ADD CONSTRAINT "WorkspaceSetting_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateTable CustomWorkspaceCocktailRecipeStepAction
CREATE TABLE "WorkspaceCocktailRecipeStepAction"
(
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "actionGroup" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,


    CONSTRAINT "WorkspaceCocktailRecipeStepAction_pkey" PRIMARY KEY ("id")

);
-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceCocktailRecipeStepAction_workspaceId_name_actionGr_key" ON "WorkspaceCocktailRecipeStepAction" ("workspaceId", "name", "actionGroup");

UPDATE "CocktailRecipeStep"
SET tool = 'WITHOUT'
WHERE tool = 'POUR';
UPDATE "CocktailRecipeStep"
SET tool = 'MUDDLE'
WHERE tool = 'PESTLE';

-- Create default actions for existing workspaces
DO
$$
    DECLARE
        workspace_id TEXT;
    BEGIN
        FOR workspace_id IN SELECT id FROM "Workspace"
            LOOP

                INSERT INTO "WorkspaceCocktailRecipeStepAction" (id, name, "actionGroup", "workspaceId")
                VALUES (gen_random_uuid(), 'SHAKE', 'MIXING', workspace_id);
                INSERT INTO "WorkspaceCocktailRecipeStepAction" (id, name, "actionGroup", "workspaceId")
                VALUES (gen_random_uuid(), 'STIR', 'MIXING', workspace_id);
                INSERT INTO "WorkspaceCocktailRecipeStepAction" (id, name, "actionGroup", "workspaceId")
                VALUES (gen_random_uuid(), 'FLOAT', 'MIXING', workspace_id);
                INSERT INTO "WorkspaceCocktailRecipeStepAction" (id, name, "actionGroup", "workspaceId")
                VALUES (gen_random_uuid(), 'BUILD_IN_GLASS', 'MIXING', workspace_id);
                INSERT INTO "WorkspaceCocktailRecipeStepAction" (id, name, "actionGroup", "workspaceId")
                VALUES (gen_random_uuid(), 'BLENDER', 'MIXING', workspace_id);
                INSERT INTO "WorkspaceCocktailRecipeStepAction" (id, name, "actionGroup", "workspaceId")
                VALUES (gen_random_uuid(), 'MUDDLE', 'MIXING', workspace_id);
                INSERT INTO "WorkspaceCocktailRecipeStepAction" (id, name, "actionGroup", "workspaceId")
                VALUES (gen_random_uuid(), 'FOAM', 'MIXING', workspace_id);


                INSERT INTO "WorkspaceCocktailRecipeStepAction" (id, name, "actionGroup", "workspaceId")
                VALUES (gen_random_uuid(), 'SINGLE_STRAIN', 'POURING', workspace_id);
                INSERT INTO "WorkspaceCocktailRecipeStepAction" (id, name, "actionGroup", "workspaceId")
                VALUES (gen_random_uuid(), 'DOUBLE_STRAIN', 'POURING', workspace_id);
                INSERT INTO "WorkspaceCocktailRecipeStepAction" (id, name, "actionGroup", "workspaceId")
                VALUES (gen_random_uuid(), 'WITHOUT', 'POURING', workspace_id);
                INSERT INTO "WorkspaceCocktailRecipeStepAction" (id, name, "actionGroup", "workspaceId")
                VALUES (gen_random_uuid(), 'DIRTY_ICE', 'POURING', workspace_id);

                INSERT INTO "WorkspaceSetting" ("workspaceId", "setting", "value")
                VALUES (workspace_id, 'translations',
                        '{"de": {"SHAKE": "Shaken", "STIR": "Rühren", "FLOAT": "Floaten", "BUILD_IN_GLASS": "Im Glas bauen", "BLENDER": "Im Blender", "MUDDLE": "Muddlen", "FOAM": "Aufschäumen", "SINGLE_STRAIN": "Single Strain", "DOUBLE_STRAIN": "Double Strain", "WITHOUT": "Einschänken", "DIRTY_ICE": "Dirty Ice", "MIXING": "Mixen", "POURING": "Einschenken"}}');

            END LOOP;
    END
$$;

ALTER TABLE "CocktailRecipeStep"
    ADD COLUMN "actionId" TEXT;


-- AddForeignKey
ALTER TABLE "WorkspaceCocktailRecipeStepAction"
    ADD CONSTRAINT "WorkspaceCocktailRecipeStepAction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CocktailRecipeStep"
    ADD CONSTRAINT "CocktailRecipeStep_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "WorkspaceCocktailRecipeStepAction" ("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Update existing cocktail recipe steps with actionId
DO
$$
    DECLARE
        cocktailRecipeStepId TEXT;
        workspace_id         TEXT;
        action               TEXT;
    BEGIN
        FOR cocktailRecipeStepId, workspace_id, action IN SELECT "CocktailRecipeStep".id, W.id, tool
                                                          FROM "CocktailRecipeStep"
                                                                   INNER JOIN public."CocktailRecipe" CR
                                                                              on CR.id = "CocktailRecipeStep"."cocktailRecipeId"
                                                                   INNER JOIN public."Workspace" W on W.id = CR."workspaceId"
            LOOP
                UPDATE "CocktailRecipeStep"
                SET "actionId" = (SELECT id
                                  FROM "WorkspaceCocktailRecipeStepAction"
                                  WHERE "WorkspaceCocktailRecipeStepAction"."workspaceId" = workspace_id
                                    AND "WorkspaceCocktailRecipeStepAction"."name" = action)
                WHERE id = cocktailRecipeStepId;

            END LOOP;
    END
$$;

-- DropColumn
ALTER TABLE "CocktailRecipeStep"
    DROP COLUMN "mixing",
    DROP COLUMN "tool",
    ALTER COLUMN "actionId" SET NOT NULL;
