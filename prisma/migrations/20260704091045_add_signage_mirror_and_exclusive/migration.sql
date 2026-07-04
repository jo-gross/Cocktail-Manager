-- AlterTable
ALTER TABLE "Signage" ADD COLUMN     "mirrorSourceFormat" "MonitorFormat";

-- AlterTable
ALTER TABLE "SignageSlide" ADD COLUMN     "dateExclusive" BOOLEAN NOT NULL DEFAULT false;
