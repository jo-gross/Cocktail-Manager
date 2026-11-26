-- Workspace timestamps for the instance API (docs/INSTANCE-API.md).
-- Timestamps are UTC like every value Prisma writes, independent of the time zone of the database session.
-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now()),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC'::text, now());

-- CreateIndex
CREATE INDEX "Workspace_updatedAt_idx" ON "Workspace"("updatedAt");

-- CreateIndex
-- Latest activity per workspace in the instance inventory (`lastActivityAt`): one index lookup per workspace instead of
-- reading every audit log row of the page's workspaces.
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");

-- Back-fill: createdAt is the oldest audit log entry of the workspace, otherwise the migration time (the column
-- default). updatedAt stays at the migration time, so the first `updatedSince` sync after the upgrade sees every
-- workspace.
UPDATE "Workspace" AS w
SET "createdAt" = logs."oldest"
FROM (SELECT "workspaceId", MIN("createdAt") AS "oldest" FROM "AuditLog" GROUP BY "workspaceId") AS logs
WHERE logs."workspaceId" = w."id" AND logs."oldest" < w."createdAt";

-- updatedAt = last change of something the control plane mirrors. Triggers instead of application code, so no
-- write path (controllers, imports, raw SQL, cascades) can miss it. Prisma does not manage triggers; `migrate dev`
-- leaves them alone. Name and email of members are not covered: a trigger on "User" would lock every workspace of
-- the user on each rename (slow for members of many workspaces, deadlocks with imports); the control plane's full
-- listing picks those changes up.

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

-- Child rows that carry a "workspaceId": members, settings, template mark. A workspace already touched in this
-- transaction (same `now()`, compared at the column's millisecond precision) is skipped, so an import that writes
-- many child rows updates the workspace row once instead of once per row.
CREATE FUNCTION "workspace_touch_from_child"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  touched_at TIMESTAMP(3) := timezone('UTC', now());
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE "Workspace" SET "updatedAt" = touched_at WHERE "id" = NEW."workspaceId" AND "updatedAt" < touched_at;
  END IF;
  IF TG_OP = 'DELETE' THEN
    UPDATE "Workspace" SET "updatedAt" = touched_at WHERE "id" = OLD."workspaceId" AND "updatedAt" < touched_at;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD."workspaceId" IS DISTINCT FROM NEW."workspaceId" THEN
      UPDATE "Workspace" SET "updatedAt" = touched_at WHERE "id" = OLD."workspaceId" AND "updatedAt" < touched_at;
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
