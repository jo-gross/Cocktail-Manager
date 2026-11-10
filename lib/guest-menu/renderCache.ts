/**
 * In-memory LRU cache for public (published) menu renders – caps the CPU cost
 * of Liquid rendering per menu under load. Short TTL: data changes (prices,
 * "heute aus", schedule) show up within `RENDER_CACHE_TTL_MS`; a new publish
 * changes `publishedAt`/`updatedAt` and therefore the key immediately.
 * Never used for previews (drafts change constantly and carry preview tokens).
 */
import { createHash } from 'crypto';
import type { GuestMenu } from '@generated/prisma/client';
import type { GuestMenuOutput } from './schema';

export const RENDER_CACHE_TTL_MS = 60_000;
export const RENDER_CACHE_MAX_ENTRIES = 200;

interface Entry<T> {
  expires: number;
  value: Promise<T>;
}

export class RenderCache<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(
    private readonly ttlMs = RENDER_CACHE_TTL_MS,
    private readonly maxEntries = RENDER_CACHE_MAX_ENTRIES,
    private readonly clock: () => number = Date.now,
  ) {}

  get size(): number {
    return this.entries.size;
  }

  /** Returns the cached (or in-flight) value for `key`, otherwise computes and stores it. Rejections are not cached. */
  get(key: string, compute: () => Promise<T>): Promise<T> {
    const now = this.clock();
    const hit = this.entries.get(key);
    if (hit && hit.expires > now) {
      // LRU: move to the end (most recently used).
      this.entries.delete(key);
      this.entries.set(key, hit);
      return hit.value;
    }
    if (hit) this.entries.delete(key);
    const value = compute();
    const entry: Entry<T> = { expires: now + this.ttlMs, value };
    this.entries.set(key, entry);
    value.catch(() => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
    });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    return value;
  }

  clear(): void {
    this.entries.clear();
  }
}

export interface PublicRenderKeyInput {
  workspace: { id: string; publicSlug: string | null; name: string; hasImage: boolean };
  menu: Pick<GuestMenu, 'id' | 'publishedAt' | 'updatedAt'>;
  output: GuestMenuOutput;
  locale?: string | null;
  preferredLocales?: string[];
  /** Access variant: signage token appended to image URLs (`null` = guest/public). */
  accessToken?: string | null;
}

/** Cache key of a published render: menu version + locale + output + access variant. */
export function publicRenderKey(input: PublicRenderKeyInput): string {
  const access = input.accessToken ? createHash('sha256').update(input.accessToken).digest('base64url') : '';
  return JSON.stringify([
    input.workspace.id,
    input.workspace.publicSlug,
    input.workspace.name,
    input.workspace.hasImage,
    input.menu.id,
    input.menu.publishedAt ? new Date(input.menu.publishedAt).getTime() : null,
    new Date(input.menu.updatedAt).getTime(),
    input.output,
    input.locale ?? null,
    input.locale ? null : (input.preferredLocales ?? []).slice(0, 5),
    access,
  ]);
}
