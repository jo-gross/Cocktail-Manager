/**
 * Instance API controllers (`/api/v1/instance/**`, master key only): read-only inventory of the whole instance for
 * the control plane. Instance-wide by design; no workspace scope applies. See docs/INSTANCE-API.md.
 */
import { Prisma, type Role } from '@generated/prisma/client';
import prisma from '../../../prisma/prisma';
import packageJson from '../../../package.json';
import { ApiError } from '@lib/http/ApiError';
import { allChecksOk, readinessChecks } from '@lib/health/readiness';
import { isPdfServiceConfigured } from '@lib/pdf/browser';
import { INSTANCE_API_VERSION, entitlementsMode, instanceCapabilities } from '@lib/instance/config';
import { decodeWorkspaceCursor, encodeWorkspaceCursor } from '@lib/instance/cursor';
import { latestPerWorkspace, mapUsage, pickOwners } from '@lib/instance/usage';
import {
  INSTANCE_USERS_MAX_RESULTS,
  type InstanceInfoDto,
  type InstanceUserDto,
  type InstanceUserSearchQuery,
  type InstanceWorkspaceDetailDto,
  type InstanceWorkspaceListQuery,
  type InstanceWorkspaceSummaryDto,
} from '@lib/schemas/instance';

/** The inventory: customer workspaces, without template workspaces (instance content) and demo workspaces (throw-away). */
const INVENTORY_WHERE = { isDemo: false, template: { is: null } } satisfies Prisma.WorkspaceWhereInput;

const ROLE_ORDER: Record<Role, number> = { OWNER: 0, ADMIN: 1, MANAGER: 2, USER: 3 };

const summarySelect = { id: true, name: true, createdAt: true, updatedAt: true } satisfies Prisma.WorkspaceSelect;
type SummaryRow = Prisma.WorkspaceGetPayload<{ select: typeof summarySelect }>;

const iso = (date: Date | null | undefined): string | null => (date ? date.toISOString() : null);

export async function getInstanceInfo(): Promise<InstanceInfoDto> {
  const checks = await readinessChecks();
  const mode = entitlementsMode();
  const [workspaces, users] = checks.database?.ok ? await Promise.all([prisma.workspace.count({ where: INVENTORY_WHERE }), prisma.user.count()]) : [0, 0];
  return {
    apiVersion: INSTANCE_API_VERSION,
    appVersion: packageJson.version,
    commit: process.env.GIT_SHA || null,
    capabilities: instanceCapabilities(mode),
    entitlementsMode: mode,
    migrationsReady: allChecksOk(checks),
    chromiumAvailable: isPdfServiceConfigured(),
    counts: { workspaces, users },
  };
}

/** Applied snapshot of a workspace as the inventory reports it (`EntitlementRef` of the contract). */
function entitlementRef(row: { version: number; hash: string; snapshot: Prisma.JsonValue }): InstanceWorkspaceSummaryDto['entitlement'] {
  const planKey = (row.snapshot as { planKey?: unknown } | null)?.planKey;
  return { version: row.version, hash: row.hash, planKey: typeof planKey === 'string' ? planKey : '' };
}

/**
 * Owner, member count, last activity and usage for a page of workspaces: a fixed number of grouped queries per page,
 * independent of the page size.
 */
async function summarize(rows: SummaryRow[]): Promise<InstanceWorkspaceSummaryDto[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const inPage = { workspaceId: { in: ids } };
  const now = new Date();

  const [cocktails, members, calculations, guestMenusPublished, signageScreens, apiKeys, auditLogs, owners, entitlements] = await Promise.all([
    prisma.cocktailRecipe.groupBy({ by: ['workspaceId'], where: { ...inPage, isArchived: false }, _count: { _all: true } }),
    prisma.workspaceUser.groupBy({ by: ['workspaceId'], where: inPage, _count: { _all: true }, _max: { lastOpened: true } }),
    prisma.cocktailCalculation.groupBy({ by: ['workspaceId'], where: inPage, _count: { _all: true } }),
    prisma.guestMenu.groupBy({ by: ['workspaceId'], where: { ...inPage, NOT: { published: { equals: Prisma.DbNull } } }, _count: { _all: true } }),
    prisma.signage.groupBy({ by: ['workspaceId'], where: inPage, _count: { _all: true } }),
    prisma.workspaceApiKey.groupBy({
      by: ['workspaceId'],
      where: { ...inPage, revoked: false, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      _count: { _all: true },
    }),
    // Newest audit log entry per workspace: one lookup in `AuditLog(workspaceId, createdAt)` each, instead of a
    // `groupBy` that reads every entry of the page's workspaces.
    prisma.$queryRaw<Array<{ workspaceId: string; at: Date | null }>>`
      SELECT w."id" AS "workspaceId", (SELECT max(a."createdAt") FROM "AuditLog" a WHERE a."workspaceId" = w."id") AS "at"
      FROM unnest(${ids}::text[]) AS w("id")`,
    prisma.workspaceUser.findMany({
      where: { ...inPage, role: 'OWNER' },
      select: { workspaceId: true, user: { select: { id: true, email: true, name: true, createdAt: true } } },
    }),
    prisma.workspaceEntitlement.findMany({ where: inPage, select: { workspaceId: true, version: true, hash: true, snapshot: true } }),
  ]);

  const usage = mapUsage(ids, { cocktails, members, calculations, guestMenusPublished, signageScreens, apiKeys });
  const lastActivity = latestPerWorkspace(
    auditLogs,
    members.map((group) => ({ workspaceId: group.workspaceId, at: group._max.lastOpened })),
  );
  const ownerByWorkspace = pickOwners(owners);
  const entitlementByWorkspace = new Map(entitlements.map((row) => [row.workspaceId, entitlementRef(row)]));

  return rows.map((row) => {
    const counts = usage.get(row.id)!;
    return {
      id: row.id,
      name: row.name,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
      owner: ownerByWorkspace.get(row.id) ?? null,
      memberCount: counts.members,
      lastActivityAt: iso(lastActivity.get(row.id)),
      usage: counts,
      entitlement: entitlementByWorkspace.get(row.id) ?? null,
    };
  });
}

export async function listInstanceWorkspaces(query: InstanceWorkspaceListQuery): Promise<{ items: InstanceWorkspaceSummaryDto[]; nextCursor: string | null }> {
  const after = query.cursor ? decodeWorkspaceCursor(query.cursor) : null;
  const search = query.q ? query.q : undefined;
  const where: Prisma.WorkspaceWhereInput = {
    ...INVENTORY_WHERE,
    ...(after ? { id: { gt: after } } : {}),
    ...(query.updatedSince ? { updatedAt: { gte: new Date(query.updatedSince) } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { users: { some: { role: 'OWNER', user: { email: { contains: search, mode: 'insensitive' } } } } },
          ],
        }
      : {}),
  };

  // One extra row tells whether another page follows.
  const rows = await prisma.workspace.findMany({ where, select: summarySelect, orderBy: { id: 'asc' }, take: query.limit + 1 });
  const page = rows.slice(0, query.limit);
  const nextCursor = rows.length > query.limit ? encodeWorkspaceCursor(page[page.length - 1]!.id) : null;
  return { items: await summarize(page), nextCursor };
}

export async function getInstanceWorkspace(id: string): Promise<InstanceWorkspaceDetailDto> {
  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: {
      ...summarySelect,
      template: { select: { key: true } },
      users: { select: { role: true, lastOpened: true, user: { select: { id: true, email: true, name: true } } } },
      WorkspaceJoinRequest: { select: { date: true, user: { select: { id: true, email: true, name: true } } }, orderBy: { date: 'asc' } },
    },
  });
  if (!workspace) throw new ApiError(404, 'NOT_FOUND', 'Workspace not found');

  const [summary] = await summarize([workspace]);
  const members = workspace.users
    .map((member) => ({
      userId: member.user.id,
      email: member.user.email ?? '',
      name: member.user.name ?? '',
      role: member.role,
      lastOpened: iso(member.lastOpened),
    }))
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name) || a.userId.localeCompare(b.userId));

  return {
    ...summary!,
    members,
    template: workspace.template ? { key: workspace.template.key } : null,
    pendingJoinRequests: workspace.WorkspaceJoinRequest.map((request) => ({
      userId: request.user.id,
      email: request.user.email ?? '',
      name: request.user.name ?? '',
      createdAt: request.date.toISOString(),
    })),
  };
}

export async function searchInstanceUsers(query: InstanceUserSearchQuery): Promise<InstanceUserDto[]> {
  const search = query.q ? query.q : undefined;
  const now = new Date();
  const users = await prisma.user.findMany({
    where: search ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }] } : undefined,
    orderBy: [{ email: 'asc' }, { id: 'asc' }],
    take: INSTANCE_USERS_MAX_RESULTS,
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      accounts: { select: { providerId: true } },
      workspaces: { select: { role: true, workspace: { select: { id: true, name: true } } } },
      _count: { select: { sessions: { where: { expiresAt: { gt: now } } } } },
    },
  });

  return users.map((user) => ({
    id: user.id,
    email: user.email ?? '',
    name: user.name ?? '',
    createdAt: user.createdAt.toISOString(),
    providers: [...new Set(user.accounts.map((account) => account.providerId))].sort(),
    workspaces: user.workspaces
      .map((membership) => ({ id: membership.workspace.id, name: membership.workspace.name, role: membership.role }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    activeSessions: user._count.sessions,
  }));
}
