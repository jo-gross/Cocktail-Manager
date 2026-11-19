-- Workspace timestamps for the instance API (docs/INSTANCE-API.md).
-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Workspace_updatedAt_idx" ON "Workspace"("updatedAt");

-- Back-fill: createdAt is the oldest audit log entry of the workspace, otherwise the migration time (the column
-- default). updatedAt stays at the migration time, so the first `updatedSince` sync after the upgrade sees every
-- workspace.
UPDATE "Workspace" AS w
SET "createdAt" = logs."oldest"
FROM (SELECT "workspaceId", MIN("createdAt") AS "oldest" FROM "AuditLog" GROUP BY "workspaceId") AS logs
WHERE logs."workspaceId" = w."id" AND logs."oldest" < w."createdAt";

-- updatedAt = last change of something the control plane mirrors. Triggers instead of application code, so no
-- write path (controllers, imports, raw SQL, cascades) can miss it. Prisma does not manage triggers; `migrate dev`
-- leaves them alone. Timestamps are UTC like every value Prisma writes.

-- Any update of the workspace row itself.
CREATE FUNCTION "workspace_touch_self"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" := timezone('UTC', now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER "workspace_touch_self"
BEFORE UPDATE ON "Workspace"
FOR EACH ROW EXECUTE FUNCTION "workspace_touch_self"();

-- Child rows that carry a "workspaceId": members, settings, template mark.
CREATE FUNCTION "workspace_touch_from_child"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE "Workspace" SET "updatedAt" = timezone('UTC', now()) WHERE "id" = NEW."workspaceId";
  END IF;
  IF TG_OP = 'DELETE' THEN
    UPDATE "Workspace" SET "updatedAt" = timezone('UTC', now()) WHERE "id" = OLD."workspaceId";
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD."workspaceId" IS DISTINCT FROM NEW."workspaceId" THEN
      UPDATE "Workspace" SET "updatedAt" = timezone('UTC', now()) WHERE "id" = OLD."workspaceId";
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

-- Members: joining, leaving and role changes. `lastOpened` changes on every visit and is not mirrored.
CREATE TRIGGER "workspace_user_touch_workspace"
AFTER INSERT OR DELETE ON "WorkspaceUser"
FOR EACH ROW EXECUTE FUNCTION "workspace_touch_from_child"();

CREATE TRIGGER "workspace_user_role_touch_workspace"
AFTER UPDATE ON "WorkspaceUser"
FOR EACH ROW
WHEN (OLD."role" IS DISTINCT FROM NEW."role" OR OLD."userId" IS DISTINCT FROM NEW."userId" OR OLD."workspaceId" IS DISTINCT FROM NEW."workspaceId")
EXECUTE FUNCTION "workspace_touch_from_child"();

CREATE TRIGGER "workspace_setting_touch_workspace"
AFTER INSERT OR UPDATE OR DELETE ON "WorkspaceSetting"
FOR EACH ROW EXECUTE FUNCTION "workspace_touch_from_child"();

-- Template mark: set, removed or re-keyed. Metadata updates of the template (version, texts) are not mirrored.
CREATE TRIGGER "workspace_template_touch_workspace"
AFTER INSERT OR DELETE ON "WorkspaceTemplate"
FOR EACH ROW EXECUTE FUNCTION "workspace_touch_from_child"();

CREATE TRIGGER "workspace_template_key_touch_workspace"
AFTER UPDATE ON "WorkspaceTemplate"
FOR EACH ROW
WHEN (OLD."key" IS DISTINCT FROM NEW."key" OR OLD."workspaceId" IS DISTINCT FROM NEW."workspaceId")
EXECUTE FUNCTION "workspace_touch_from_child"();

-- Name and email of members are mirrored too (owner, member list).
CREATE FUNCTION "workspace_touch_from_user"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "Workspace" SET "updatedAt" = timezone('UTC', now())
  WHERE "id" IN (SELECT "workspaceId" FROM "WorkspaceUser" WHERE "userId" = NEW."id");
  RETURN NULL;
END;
$$;

CREATE TRIGGER "user_touch_workspaces"
AFTER UPDATE ON "User"
FOR EACH ROW
WHEN (OLD."name" IS DISTINCT FROM NEW."name" OR OLD."email" IS DISTINCT FROM NEW."email")
EXECUTE FUNCTION "workspace_touch_from_user"();
