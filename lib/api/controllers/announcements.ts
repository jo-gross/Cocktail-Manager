/**
 * Announcements of the control plane: the push that replaces the full set (instance API, master key only) and the
 * reads of the banner. Self-hosted instances never get a push, so the reads are always empty there.
 * See docs/INSTANCE-API.md.
 */
import { createHash } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import type { InstanceAnnouncement, Prisma } from '@generated/prisma/client';
import prisma from '../../../prisma/prisma';
import { lockWorkspaceScope } from '@lib/db/tx';
import { runControlPlaneWrite } from '@lib/instance/controlPlaneWrite';
import { canonicalJson } from '@lib/instance/fingerprint';
import { compareAnnouncements, isAnnouncementLevel, isDismissible, readStoredAnnouncementText } from '@lib/announcements/text';
import type { AnnouncementDto, AnnouncementsPutInput } from '@lib/schemas/announcements';

export async function replaceAnnouncements(headers: IncomingHttpHeaders, input: AnnouncementsPutInput): Promise<{ count: number }> {
  const rows = input.announcements.map((announcement) => ({
    id: announcement.id,
    level: announcement.level,
    title: announcement.title,
    body: announcement.body,
    startsAt: announcement.startsAt ? new Date(announcement.startsAt) : null,
    endsAt: announcement.endsAt ? new Date(announcement.endsAt) : null,
    workspaceIds: [...new Set(announcement.workspaceIds)],
  })) satisfies Prisma.InstanceAnnouncementCreateManyInput[];

  return runControlPlaneWrite({
    headers,
    action: 'announcements.replace',
    target: { type: 'instance', id: null },
    payload: input,
    apply: async (tx) => {
      // Concurrent pushes replace one after the other, never interleaved.
      await lockWorkspaceScope(tx, 'instance', 'announcements');
      const previous = await tx.instanceAnnouncement.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
      await tx.instanceAnnouncement.deleteMany({});
      if (rows.length > 0) await tx.instanceAnnouncement.createMany({ data: rows });
      return {
        response: { count: rows.length },
        details: {
          previousIds: previous.map((row) => row.id),
          announcements: rows.map((row) => ({ id: row.id, level: row.level, workspaces: row.workspaceIds.length })),
        },
      };
    },
  });
}

function revisionOf(row: InstanceAnnouncement): string {
  return createHash('sha256')
    .update(canonicalJson({ level: row.level, title: row.title, body: row.body, startsAt: row.startsAt?.toISOString(), endsAt: row.endsAt?.toISOString() }))
    .digest('hex')
    .slice(0, 16);
}

function toDto(row: InstanceAnnouncement): AnnouncementDto | null {
  const body = readStoredAnnouncementText(row.body);
  if (!isAnnouncementLevel(row.level) || !body) return null;
  const level = row.level;
  return {
    id: row.id,
    level,
    title: readStoredAnnouncementText(row.title),
    body,
    dismissible: isDismissible(level),
    revision: revisionOf(row),
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
  };
}

/**
 * Announcements that are active at `now`: for a workspace those targeting all workspaces or this one, without a
 * workspace (workspace overview) only those targeting all. Most severe first.
 */
export async function listActiveAnnouncements(workspaceId: string | null, now: Date = new Date()): Promise<AnnouncementDto[]> {
  const forAll: Prisma.InstanceAnnouncementWhereInput = { workspaceIds: { isEmpty: true } };
  const rows = await prisma.instanceAnnouncement.findMany({
    where: {
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        workspaceId === null ? forAll : { OR: [forAll, { workspaceIds: { has: workspaceId } }] },
      ],
    },
  });
  return rows
    .map(toDto)
    .filter((dto): dto is AnnouncementDto => dto !== null)
    .sort(compareAnnouncements);
}
