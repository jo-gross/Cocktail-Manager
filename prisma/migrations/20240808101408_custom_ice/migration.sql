/*
  Warnings:

  - You are about to drop the column `glassWithIce` on the `CocktailRecipe` table. All the data in the column will be lost.
  - Added the required column `iceId` to the `CocktailRecipe` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CocktailRecipe"
    ADD COLUMN "iceId" TEXT;

-- CreateTable
CREATE TABLE "Ice"
(
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "Ice_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CocktailRecipe"
    ADD CONSTRAINT "CocktailRecipe_iceId_fkey" FOREIGN KEY ("iceId") REFERENCES "Ice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ice"
    ADD CONSTRAINT "Ice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add the unique constraint
CREATE UNIQUE INDEX "Ice_name_workspaceId_key" ON "Ice" ("name", "workspaceId");

-- Transform Ice Types to other names
UPDATE "CocktailRecipe"
SET "glassWithIce" = 'ICE_CUBES'
WHERE "glassWithIce" = 'Würfel';
UPDATE "CocktailRecipe"
SET "glassWithIce" = 'ICE_CRUSHED'
WHERE "glassWithIce" = 'Crushed';
UPDATE "CocktailRecipe"
SET "glassWithIce" = 'ICE_BALL'
WHERE "glassWithIce" = 'Kugel';
UPDATE "CocktailRecipe"
SET "glassWithIce" = 'WITHOUT_ICE'
WHERE "glassWithIce" = 'Ohne';

CREATE OR REPLACE FUNCTION createIce()
    RETURNS VOID
AS
$$
DECLARE
    workspace_id text;

BEGIN
    -- iterate through every workspace, to don´t mix them up
    FOR workspace_id in SELECT id FROM "Workspace"
        LOOP
            -- insert all default units

            INSERT INTO "Ice" (id, name, "workspaceId")
            SELECT gen_random_uuid(), 'ICE_CRUSHED', workspace_id
            WHERE NOT EXISTS(SELECT id FROM "Ice" WHERE name = 'ICE_CRUSHED' AND workspace_id = "workspaceId");

            INSERT INTO "Ice" (id, name, "workspaceId")
            SELECT gen_random_uuid(), 'ICE_CUBES', workspace_id
            WHERE NOT EXISTS(SELECT id FROM "Ice" WHERE name = 'ICE_CUBES' AND workspace_id = "workspaceId");

            INSERT INTO "Ice" (id, name, "workspaceId")
            SELECT gen_random_uuid(), 'ICE_BALL', workspace_id
            WHERE NOT EXISTS(SELECT id FROM "Ice" WHERE name = 'ICE_BALL' AND workspace_id = "workspaceId");

            INSERT INTO "Ice" (id, name, "workspaceId")
            SELECT gen_random_uuid(), 'WITHOUT_ICE', workspace_id
            WHERE NOT EXISTS(SELECT id FROM "Ice" WHERE name = 'WITHOUT_ICE' AND workspace_id = "workspaceId");


            -- update all ice


        END LOOP;
END;
$$ LANGUAGE plpgsql;


SELECT createIce();

UPDATE "CocktailRecipe"
SET "iceId" = (SELECT id
               FROM "Ice"
               WHERE "Ice"."workspaceId" = "CocktailRecipe"."workspaceId"
                 AND "Ice".name = "CocktailRecipe"."glassWithIce")
WHERE TRUE;

ALTER TABLE "CocktailRecipe"
    ALTER COLUMN "iceId" SET NOT NULL;

ALTER TABLE "CocktailRecipe"
    DROP COLUMN "glassWithIce";

