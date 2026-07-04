-- AlterTable
ALTER TABLE "SignageSlide" ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "validFrom" DATE,
ADD COLUMN     "validTo" DATE,
ADD COLUMN     "weekdays" INTEGER[];
