/*
  Warnings:

  - You are about to drop the column `showTime` on the `CocktailCard` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "Setting" ADD VALUE 'showTime';

-- AlterTable
ALTER TABLE "CocktailCard"
    DROP COLUMN "showTime";
