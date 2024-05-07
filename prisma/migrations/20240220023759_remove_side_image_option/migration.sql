/*
  Warnings:

  - The values [showImageSide] on the enum `Setting` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;

DELETE
FROM "UserSetting"
WHERE "setting" = 'showImageSide';

CREATE TYPE "Setting_new" AS ENUM ('showImage', 'showTags', 'lessItems', 'theme', 'showStatisticActions');
ALTER TABLE "UserSetting"
    ALTER COLUMN "setting" TYPE "Setting_new" USING ("setting"::text::"Setting_new");
ALTER TYPE "Setting" RENAME TO "Setting_old";
ALTER TYPE "Setting_new" RENAME TO "Setting";
DROP TYPE "Setting_old";
COMMIT;
