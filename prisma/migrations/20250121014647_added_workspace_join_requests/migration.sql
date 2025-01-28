-- CreateTable
CREATE TABLE "WorkspaceJoinCode"
(
    "code"        TEXT         NOT NULL,
    "expires"     TIMESTAMP(3),
    "onlyUseOnce" BOOLEAN      NOT NULL DEFAULT false,
    "used"        INTEGER      NOT NULL DEFAULT 0,
    "workspaceId" TEXT         NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceJoinCode_pkey" PRIMARY KEY ("workspaceId", "code")
);

-- CreateTable
CREATE TABLE "WorkspaceJoinRequest"
(
    "workspaceId" TEXT         NOT NULL,
    "userId"      TEXT         NOT NULL,
    "date"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceJoinRequest_pkey" PRIMARY KEY ("userId", "workspaceId")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceJoinCode_code_key" ON "WorkspaceJoinCode" ("code");

-- AddForeignKey
ALTER TABLE "WorkspaceJoinCode"
    ADD CONSTRAINT "WorkspaceJoinCode_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceJoinRequest"
    ADD CONSTRAINT "WorkspaceJoinRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceJoinRequest"
    ADD CONSTRAINT "WorkspaceJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
