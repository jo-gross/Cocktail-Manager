/**
 * Instance administration of templates (`/api/admin/templates`, master key only).
 * Built-in templates (`templates/<key>/`) are read-only: they can be published,
 * ordered and made default, but not unmarked or edited – clone them instead.
 */
import { Prisma, type WorkspaceTemplate } from '@generated/prisma/client';
import prisma from '../../../prisma/prisma';
import { ApiError } from '@lib/http/ApiError';
import { BULK_TX_TIMEOUT_MS, runTx, type Tx } from '@lib/db/tx';
import { executeBackupImport, prepareBackupImport } from '@lib/backup/importHandler';
import { regenerateUnitConversionsTx } from '@lib/api/controllers/units';
import { ensureBuiltInTemplatesSafe, findTemplate, readTemplateContent } from '@lib/templates/applyTemplate';
import { clearOtherDefaults, createTemplateWorkspace, lockTemplates } from '@lib/templates/sync';
import { generateJoinCode, isUniqueViolation, JOIN_CODE_ATTEMPTS } from '@lib/workspace/adminCreateWorkspace';
import type {
  AdminTemplateAccessDto,
  AdminTemplateCloneInput,
  AdminTemplateCreateInput,
  AdminTemplateDto,
  AdminTemplateUpdateInput,
} from '@lib/schemas/adminTemplates';

type TemplateWithMembers = WorkspaceTemplate & { workspace: { _count: { users: number } } };

const withMembers = { workspace: { select: { _count: { select: { users: true } } } } } as const;

function toDto(template: TemplateWithMembers): AdminTemplateDto {
  return {
    key: template.key,
    workspaceId: template.workspaceId,
    kind: template.kind,
    name: template.name as Record<string, string>,
    description: (template.description as Record<string, string> | null) ?? null,
    locales: template.locales,
    source: template.source,
    builtIn: template.builtIn,
    version: template.version,
    published: template.published,
    isDefault: template.isDefault,
    sortOrder: template.sortOrder,
    memberCount: template.workspace._count.users,
    updatedAt: template.updatedAt.toISOString(),
  };
}

async function findInTx(tx: Tx, key: string): Promise<WorkspaceTemplate> {
  const template = await tx.workspaceTemplate.findUnique({ where: { key } });
  if (!template) throw new ApiError(404, 'TEMPLATE_NOT_FOUND', 'Template not found');
  return template;
}

async function loadDto(key: string): Promise<AdminTemplateDto> {
  return toDto(await prisma.workspaceTemplate.findUniqueOrThrow({ where: { key }, include: withMembers }));
}

const keyTaken = () => new ApiError(409, 'TEMPLATE_KEY_TAKEN', 'A template with this key already exists');

export async function listAdminTemplates(): Promise<AdminTemplateDto[]> {
  await ensureBuiltInTemplatesSafe();
  const templates = await prisma.workspaceTemplate.findMany({ orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { key: 'asc' }], include: withMembers });
  return templates.map(toDto);
}

export async function markWorkspaceAsTemplate(input: AdminTemplateCreateInput): Promise<AdminTemplateDto> {
  await runTx(async (tx) => {
    await lockTemplates(tx);
    const workspace = await tx.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { id: true, isDemo: true, template: { select: { key: true } } },
    });
    if (!workspace) throw new ApiError(404, 'NOT_FOUND', 'Workspace not found');
    if (workspace.isDemo) throw new ApiError(400, 'DEMO_WORKSPACE', 'Demo workspaces cannot become templates');
    if (workspace.template) throw new ApiError(409, 'ALREADY_TEMPLATE', 'The workspace already is a template');
    if (await tx.workspaceTemplate.findUnique({ where: { key: input.key }, select: { key: true } })) throw keyTaken();
    if (input.isDefault) await clearOtherDefaults(tx, input.kind, workspace.id);
    await tx.workspaceTemplate.create({
      data: {
        workspaceId: workspace.id,
        key: input.key,
        kind: input.kind,
        name: input.name,
        description: input.description ?? Prisma.DbNull,
        locales: input.locales,
        source: input.source ?? null,
        published: input.published ?? false,
        isDefault: input.isDefault ?? false,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  });
  return loadDto(input.key);
}

export async function updateAdminTemplate(key: string, input: AdminTemplateUpdateInput): Promise<AdminTemplateDto> {
  await runTx(async (tx) => {
    await lockTemplates(tx);
    const template = await findInTx(tx, key);
    if (input.isDefault) await clearOtherDefaults(tx, template.kind, template.workspaceId);
    await tx.workspaceTemplate.update({
      where: { key },
      data: {
        name: input.name,
        description: input.description === null ? Prisma.DbNull : input.description,
        locales: input.locales,
        source: input.source,
        published: input.published,
        isDefault: input.isDefault,
        sortOrder: input.sortOrder,
      },
    });
  });
  return loadDto(key);
}

/** Removes the mark of a custom template (its workspace stays and becomes deletable). */
export async function unmarkAdminTemplate(key: string): Promise<AdminTemplateDto> {
  return runTx(async (tx) => {
    await lockTemplates(tx);
    const template = await tx.workspaceTemplate.findUnique({ where: { key }, include: withMembers });
    if (!template) throw new ApiError(404, 'TEMPLATE_NOT_FOUND', 'Template not found');
    if (template.builtIn) throw new ApiError(409, 'BUILT_IN_TEMPLATE', 'Built-in templates cannot be removed');
    await tx.workspaceTemplate.delete({ where: { key } });
    return toDto(template);
  });
}

async function createOneTimeJoinCode(tx: Tx, workspaceId: string): Promise<string> {
  const code = generateJoinCode(10);
  await tx.workspaceJoinCode.create({ data: { workspaceId, code, onlyUseOnce: true, expires: null } });
  return code;
}

/** Retries the whole transaction when a generated join code collides. */
async function withJoinCodeRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt < JOIN_CODE_ATTEMPTS && isUniqueViolation(error) && !(error instanceof ApiError)) continue;
      throw error;
    }
  }
}

export async function cloneAdminTemplate(sourceKey: string, input: AdminTemplateCloneInput): Promise<AdminTemplateAccessDto> {
  const source = await findTemplate(sourceKey, false);
  if (await prisma.workspaceTemplate.findUnique({ where: { key: input.key }, select: { key: true } })) throw keyTaken();
  const { data } = await readTemplateContent(source);
  const name = input.name ?? (source.name as Record<string, string>);

  const joinCode = await withJoinCodeRetry(() => {
    // Prepared per attempt: record ids are generated during preparation.
    const prepared = prepareBackupImport(data);
    return runTx(
      async (tx) => {
        await lockTemplates(tx);
        if (await tx.workspaceTemplate.findUnique({ where: { key: input.key }, select: { key: true } })) throw keyTaken();
        const workspace = await createTemplateWorkspace(tx, { name, locales: source.locales });
        await executeBackupImport(tx, prepared, null, workspace.id, {
          keepGuestMenuState: true,
          audit: { entityType: 'WorkspaceTemplate', action: 'CLONE', details: { template: source.key, version: source.version, clone: input.key } },
        });
        await regenerateUnitConversionsTx(tx, workspace.id);
        await tx.workspaceTemplate.create({
          data: {
            workspaceId: workspace.id,
            key: input.key,
            kind: source.kind,
            name,
            description: source.description ?? Prisma.DbNull,
            locales: source.locales,
            source: `clone:${source.key}@${source.version}`,
          },
        });
        return createOneTimeJoinCode(tx, workspace.id);
      },
      { timeout: BULK_TX_TIMEOUT_MS },
    );
  });
  return { template: await loadDto(input.key), joinCode };
}

/** One-time join code to edit a custom template (memberless: the first member becomes owner). */
export async function createAdminTemplateAccess(key: string): Promise<AdminTemplateAccessDto> {
  const joinCode = await withJoinCodeRetry(() =>
    runTx(async (tx) => {
      const template = await findInTx(tx, key);
      if (template.builtIn) throw new ApiError(409, 'BUILT_IN_TEMPLATE', 'Built-in templates are read-only; clone them to make changes');
      return createOneTimeJoinCode(tx, template.workspaceId);
    }),
  );
  return { template: await loadDto(key), joinCode };
}
