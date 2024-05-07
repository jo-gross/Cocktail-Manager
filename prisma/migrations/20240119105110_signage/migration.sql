-- CreateEnum
CREATE TYPE "MonitorFormat" AS ENUM ('LANDSCAPE', 'PORTRAIT');

-- CreateTable
CREATE TABLE "Signage"
(
    "workspaceId"     TEXT            NOT NULL,
    "format"          "MonitorFormat" NOT NULL,
    "content"         TEXT            NOT NULL,
    "backgroundColor" TEXT,

    CONSTRAINT "Signage_pkey" PRIMARY KEY ("workspaceId", "format")
);

-- AddForeignKey
ALTER TABLE "Signage"
    ADD CONSTRAINT "Signage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
