/*
  Warnings:

  - You are about to drop the column `content` on the `Signage` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Signage" DROP COLUMN "content",
ADD COLUMN     "slideDurationSeconds" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "SignageSlide" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "format" "MonitorFormat" NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "SignageSlide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignageSlide_workspaceId_format_order_idx" ON "SignageSlide"("workspaceId", "format", "order");

-- AddForeignKey
ALTER TABLE "SignageSlide" ADD CONSTRAINT "SignageSlide_workspaceId_format_fkey" FOREIGN KEY ("workspaceId", "format") REFERENCES "Signage"("workspaceId", "format") ON DELETE CASCADE ON UPDATE CASCADE;
