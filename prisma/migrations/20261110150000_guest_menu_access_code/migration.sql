-- AlterTable
ALTER TABLE "GuestMenu" ADD COLUMN     "accessCodeHash" TEXT,
ADD COLUMN     "accessCodeVersion" INTEGER NOT NULL DEFAULT 0;
