/**
 * Prisma → public DTO mapping for the workspace resource. Keeps the /api/v1
 * contract clean: no PascalCase relation keys (`WorkspaceSetting`), settings are
 * exposed as a flat key→value map, and members carry only public user fields.
 */
import type { User, Workspace, WorkspaceSetting, WorkspaceUser } from '@generated/prisma/client';
import type { WorkspaceDto, WorkspaceMemberDto, WorkspaceSettingsDto } from '@lib/schemas/workspace';

type MemberWithUser = Pick<WorkspaceUser, 'role' | 'lastOpened'> & {
  user: Pick<User, 'id' | 'name' | 'email' | 'image'>;
};

function toMemberDto(member: MemberWithUser): WorkspaceMemberDto {
  return {
    userId: member.user.id,
    name: member.user.name,
    email: member.user.email,
    image: member.user.image,
    role: member.role,
    lastOpened: member.lastOpened ? member.lastOpened.toISOString() : null,
  };
}

/** Flatten Prisma WorkspaceSetting rows into a `{ [key]: value }` map. */
export function toWorkspaceSettingsDto(settings: Pick<WorkspaceSetting, 'setting' | 'value'>[]): WorkspaceSettingsDto {
  const map: Partial<WorkspaceSettingsDto> = {};
  for (const s of settings) {
    map[s.setting] = s.value;
  }
  return map as WorkspaceSettingsDto;
}

export function toWorkspaceDto(
  workspace: Pick<Workspace, 'id' | 'name' | 'description' | 'image' | 'isDemo' | 'expiresAt'>,
  settings: Pick<WorkspaceSetting, 'setting' | 'value'>[],
  members: MemberWithUser[],
  isExternallyManaged: boolean,
): WorkspaceDto {
  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    image: workspace.image,
    isDemo: workspace.isDemo,
    expiresAt: workspace.expiresAt ? workspace.expiresAt.toISOString() : null,
    isExternallyManaged,
    settings: toWorkspaceSettingsDto(settings),
    members: members.map(toMemberDto),
  };
}
