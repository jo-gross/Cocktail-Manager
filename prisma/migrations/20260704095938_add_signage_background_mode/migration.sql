-- CreateEnum
CREATE TYPE "SignageBackgroundMode" AS ENUM ('COLOR', 'BLURRED');

-- AlterTable
ALTER TABLE "Signage" ADD COLUMN     "backgroundMode" "SignageBackgroundMode" NOT NULL DEFAULT 'COLOR';
