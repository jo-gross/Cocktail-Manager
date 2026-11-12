/**
 * Signage (v1 admin + public monitor feed): slides lifecycle, image validation and
 * serving, tenant isolation (path and body ids), scope denial, append-order and
 * exclusive-overlap concurrency, and the key-gated `includeInactive` of /api/signage/{id}.
 */
import { describe, expect, it } from 'vitest';
import prisma from '../../../../prisma/prisma';
import { guestMenuSlideItemHandler, guestMenuSlidesHandler, signageHandler, slideImageHandler, slideItemHandler, slidesHandler } from '@lib/api/v1/signage';
import publicSignageHandler from '../../../../pages/api/signage/[id]';
import { ensureSignageContainer } from '@lib/signage/signageApiHelpers';
import { seedApiKey } from '@test/helpers/dbFixtures';
import { invokeHandler } from '@test/helpers/invokeHandler';
import { callAs, dataOf, errorCodeOf, roleUser, seedTenantPair } from '@test/helpers/scenario';
import { PNG_DATA_URI, seedGuestMenu, seedSlide, snapshotSlide } from '@test/helpers/fixtures/g5';

interface SlideDto {
  id: string;
  order: number;
  enabled: boolean;
  imageUrl: string | null;
  guestMenuId: string | null;
}

describe('signage v1 (integration)', () => {
  it('uploads, lists, schedules, reorders, serves and deletes slides', async () => {
    const { a } = await seedTenantPair();
    const manager = roleUser(a, 'MANAGER');
    const workspaceId = a.workspace.id;

    const uploaded = await callAs(manager, slidesHandler, {
      method: 'POST',
      query: { workspaceId },
      body: { format: 'LANDSCAPE', slides: [PNG_DATA_URI, PNG_DATA_URI] },
    });
    expect(uploaded.status).toBe(201);
    const [first, second] = dataOf<SlideDto[]>(uploaded);
    expect([first.order, second.order]).toEqual([0, 1]);

    const patched = await callAs(manager, slidesHandler, {
      method: 'PATCH',
      query: { workspaceId },
      body: { slideIds: [first.id], enabled: false, weekdays: [5, 1, 5], validFrom: '2026-01-01', validTo: null },
    });
    expect(patched.status).toBe(200);
    expect(await prisma.signageSlide.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ enabled: false, weekdays: [1, 5] });

    const settings = await callAs(manager, signageHandler, {
      method: 'PUT',
      query: { workspaceId },
      body: {
        landscape: {
          slideDurationSeconds: 7,
          slides: [
            { id: first.id, order: 1 },
            { id: second.id, order: 0 },
          ],
        },
      },
    });
    expect(settings.status).toBe(200);
    const [format] = dataOf<Array<{ slideDurationSeconds: number; slides: SlideDto[] }>>(settings);
    expect(format.slideDurationSeconds).toBe(7);
    expect(format.slides.map((slide) => slide.id)).toEqual([second.id, first.id]);

    const image = await callAs(roleUser(a, 'USER'), slideImageHandler, { method: 'GET', query: { workspaceId, slideId: first.id } });
    expect(image.status).toBe(200);
    expect(image.headers['Content-Type']).toBe('image/png');
    expect(image.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(Buffer.isBuffer(image.body)).toBe(true);

    const deleted = await callAs(manager, slideItemHandler, { method: 'DELETE', query: { workspaceId, slideId: first.id } });
    expect(dataOf(deleted)).toEqual({ count: 1 });
    expect((await callAs(manager, slideItemHandler, { method: 'DELETE', query: { workspaceId, slideId: first.id } })).status).toBe(404);
  });

  it('creates and updates guest menu slides', async () => {
    const { a } = await seedTenantPair();
    const manager = roleUser(a, 'MANAGER');
    const workspaceId = a.workspace.id;
    const menu = await seedGuestMenu(workspaceId);
    await seedSlide(workspaceId, { order: 4 });

    const created = await callAs(manager, guestMenuSlidesHandler, { method: 'POST', query: { workspaceId }, body: { format: 'LANDSCAPE', guestMenuId: null } });
    expect(created.status).toBe(201);
    const slide = dataOf<SlideDto>(created);
    expect(slide.order).toBe(5);

    const updated = await callAs(manager, guestMenuSlideItemHandler, {
      method: 'PATCH',
      query: { workspaceId, slideId: slide.id },
      body: { guestMenuId: menu.id, options: { columns: 2 } },
    });
    expect(updated.status).toBe(200);
    expect(dataOf<SlideDto>(updated).guestMenuId).toBe(menu.id);
  });

  describe('validation', () => {
    it.each([
      ['an SVG data URI', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='],
      ['an HTML data URI', 'data:text/html;base64,PGgxPmhpPC9oMT4='],
      ['a plain URL', 'https://example.com/a.png'],
    ])('rejects %s as slide image and writes nothing', async (_label, content) => {
      const { a } = await seedTenantPair();
      const result = await callAs(roleUser(a, 'MANAGER'), slidesHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: { format: 'LANDSCAPE', slides: [PNG_DATA_URI, content] },
      });
      expect(result.status).toBe(400);
      expect(await prisma.signageSlide.count()).toBe(0);
      expect(await prisma.signage.count()).toBe(0);
    });

    it('caps the number of slides per upload', async () => {
      const { a } = await seedTenantPair();
      const result = await callAs(roleUser(a, 'MANAGER'), slidesHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: { format: 'LANDSCAPE', slides: Array(101).fill(PNG_DATA_URI) },
      });
      expect(result.status).toBe(400);
    });

    it('rejects invalid schedule dates', async () => {
      const { a } = await seedTenantPair();
      const slide = await seedSlide(a.workspace.id);
      const result = await callAs(roleUser(a, 'MANAGER'), slidesHandler, {
        method: 'PATCH',
        query: { workspaceId: a.workspace.id },
        body: { slideIds: [slide.id], validFrom: 'next tuesday' },
      });
      expect(result.status).toBe(400);
    });

    it('does not serve stored non-image content as an image', async () => {
      const { a } = await seedTenantPair();
      const slide = await seedSlide(a.workspace.id, { content: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' });
      const result = await callAs(roleUser(a, 'USER'), slideImageHandler, { method: 'GET', query: { workspaceId: a.workspace.id, slideId: slide.id } });
      expect(result.status).toBe(404);
    });
  });

  describe('tenant isolation', () => {
    it("rejects tenant B's slide ids in path and body and leaves them unchanged", async () => {
      const { a, b } = await seedTenantPair();
      const owner = roleUser(a, 'OWNER');
      const workspaceId = a.workspace.id;
      const own = await seedSlide(workspaceId, { order: 0 });
      const foreign = await seedSlide(b.workspace.id, { order: 3 });
      const foreignMenuSlide = await seedSlide(b.workspace.id, { type: 'GUEST_MENU', order: 4 });
      const before = { own: await snapshotSlide(own.id), foreign: await snapshotSlide(foreign.id), menuSlide: await snapshotSlide(foreignMenuSlide.id) };

      const patchForeign = await callAs(owner, slidesHandler, { method: 'PATCH', query: { workspaceId }, body: { slideIds: [foreign.id], enabled: false } });
      expect(patchForeign.status).toBe(404);
      // Mixed own + foreign ids: nothing is changed, not even the own slide.
      const patchMixed = await callAs(owner, slidesHandler, {
        method: 'PATCH',
        query: { workspaceId },
        body: { slideIds: [own.id, foreign.id], enabled: false },
      });
      expect(patchMixed.status).toBe(404);
      expect(errorCodeOf(patchMixed)).toBe('SLIDES_NOT_FOUND');

      expect((await callAs(owner, slideItemHandler, { method: 'DELETE', query: { workspaceId, slideId: foreign.id } })).status).toBe(404);
      expect((await callAs(owner, slideImageHandler, { method: 'GET', query: { workspaceId, slideId: foreign.id } })).status).toBe(404);
      const menuPatch = await callAs(owner, guestMenuSlideItemHandler, {
        method: 'PATCH',
        query: { workspaceId, slideId: foreignMenuSlide.id },
        body: { guestMenuId: null },
      });
      expect(menuPatch.status).toBe(404);

      const reorder = await callAs(owner, signageHandler, {
        method: 'PUT',
        query: { workspaceId },
        body: { landscape: { slideDurationSeconds: 10, slides: [{ id: foreign.id, order: 99 }] } },
      });
      expect(reorder.status).toBe(200);

      expect(await snapshotSlide(own.id)).toEqual(before.own);
      expect(await snapshotSlide(foreign.id)).toEqual(before.foreign);
      expect(await snapshotSlide(foreignMenuSlide.id)).toEqual(before.menuSlide);
    });

    it("rejects tenant B's guest menu id in slide bodies without writing", async () => {
      const { a, b } = await seedTenantPair();
      const manager = roleUser(a, 'MANAGER');
      const workspaceId = a.workspace.id;
      const foreignMenu = await seedGuestMenu(b.workspace.id);

      const created = await callAs(manager, guestMenuSlidesHandler, {
        method: 'POST',
        query: { workspaceId },
        body: { format: 'PORTRAIT', guestMenuId: foreignMenu.id },
      });
      expect(created.status).toBe(404);
      expect(await prisma.signageSlide.count({ where: { workspaceId } })).toBe(0);
      expect(await prisma.signage.count({ where: { workspaceId } })).toBe(0);

      const own = await seedSlide(workspaceId, { type: 'GUEST_MENU' });
      const before = await snapshotSlide(own.id);
      const updated = await callAs(manager, guestMenuSlideItemHandler, {
        method: 'PATCH',
        query: { workspaceId, slideId: own.id },
        body: { guestMenuId: foreignMenu.id },
      });
      expect(updated.status).toBe(404);
      expect(await snapshotSlide(own.id)).toEqual(before);
    });
  });

  describe('authorization', () => {
    it('denies USER sessions and MONITOR_READ keys for slide writes', async () => {
      const { a } = await seedTenantPair();
      const workspaceId = a.workspace.id;
      const readKey = await seedApiKey(workspaceId, roleUser(a, 'OWNER').user.id, ['MONITOR_READ']);
      const body = { format: 'LANDSCAPE', slides: [PNG_DATA_URI] };

      expect((await callAs(roleUser(a, 'USER'), slidesHandler, { method: 'POST', query: { workspaceId }, body })).status).toBe(403);
      expect((await callAs({ apiKeyJwt: readKey.jwt }, slidesHandler, { method: 'POST', query: { workspaceId }, body })).status).toBe(403);
      expect(await prisma.signageSlide.count()).toBe(0);
    });
  });

  describe('concurrency', () => {
    it('appends concurrent uploads with unique, gapless orders (container created once)', async () => {
      const { a } = await seedTenantPair();
      const manager = roleUser(a, 'MANAGER');
      const workspaceId = a.workspace.id;
      const results = await Promise.all([
        ...Array.from({ length: 8 }, () =>
          callAs(manager, slidesHandler, { method: 'POST', query: { workspaceId }, body: { format: 'PORTRAIT', slides: [PNG_DATA_URI] } }),
        ),
        ...Array.from({ length: 4 }, () =>
          callAs(manager, guestMenuSlidesHandler, { method: 'POST', query: { workspaceId }, body: { format: 'PORTRAIT', guestMenuId: null } }),
        ),
      ]);
      expect(results.map((result) => result.status)).toEqual(Array(12).fill(201));
      const orders = (await prisma.signageSlide.findMany({ where: { workspaceId, format: 'PORTRAIT' } })).map((slide) => slide.order).sort((x, y) => x - y);
      expect(orders).toEqual(Array.from({ length: 12 }, (_, index) => index));
      expect(await prisma.signage.count({ where: { workspaceId } })).toBe(1);
    });

    it('creates the signage container idempotently under concurrency (also without the lock, e.g. backup import)', async () => {
      const { a } = await seedTenantPair();
      await Promise.all(Array.from({ length: 10 }, () => ensureSignageContainer(prisma, a.workspace.id, 'LANDSCAPE')));
      expect(await prisma.signage.count({ where: { workspaceId: a.workspace.id } })).toBe(1);
    });

    it('lets only one of several concurrent overlapping exclusive schedules through', async () => {
      const { a } = await seedTenantPair();
      const manager = roleUser(a, 'MANAGER');
      const workspaceId = a.workspace.id;
      const range = { validFrom: new Date('2026-12-01'), validTo: new Date('2026-12-31') };
      const slides = await Promise.all(Array.from({ length: 5 }, (_, order) => seedSlide(workspaceId, { order, ...range })));

      const results = await Promise.all(
        slides.map((slide) => callAs(manager, slidesHandler, { method: 'PATCH', query: { workspaceId }, body: { slideIds: [slide.id], dateExclusive: true } })),
      );
      expect(results.filter((result) => result.status === 200)).toHaveLength(1);
      expect(results.filter((result) => result.status === 409).every((result) => errorCodeOf(result) === 'EXCLUSIVE_OVERLAP')).toBe(true);
      expect(await prisma.signageSlide.count({ where: { workspaceId, dateExclusive: true } })).toBe(1);
    });
  });
});

describe('public /api/signage/{id} (integration)', () => {
  async function seedMonitor() {
    const { a } = await seedTenantPair();
    const workspaceId = a.workspace.id;
    await prisma.workspace.update({ where: { id: workspaceId }, data: { signageKey: 'monitor-key' } });
    const active = await seedSlide(workspaceId, { order: 0 });
    const disabled = await seedSlide(workspaceId, { order: 1, enabled: false });
    const future = await seedSlide(workspaceId, { order: 2, validFrom: new Date('2999-01-01') });
    return { workspaceId, active, disabled, future };
  }

  const slideIdsOf = (json: unknown) => (json as { content: { slides: Array<{ id: string }> } }).content.slides.map((slide) => slide.id);

  it('returns only active slides publicly', async () => {
    const { workspaceId, active } = await seedMonitor();
    const result = await invokeHandler(publicSignageHandler, { method: 'GET', query: { id: workspaceId, format: 'LANDSCAPE' } });
    expect(result.status).toBe(200);
    expect(slideIdsOf(result.json)).toEqual([active.id]);
  });

  it('requires the monitor key for includeInactive', async () => {
    const { workspaceId, active, disabled, future } = await seedMonitor();
    const withoutKey = await invokeHandler(publicSignageHandler, { method: 'GET', query: { id: workspaceId, format: 'LANDSCAPE', includeInactive: 'true' } });
    expect(withoutKey.status).toBe(403);
    expect(JSON.stringify(withoutKey.json)).not.toContain(disabled.id);

    const wrongKey = await invokeHandler(publicSignageHandler, { method: 'GET', query: { id: workspaceId, includeInactive: 'true', key: 'nope' } });
    expect(wrongKey.status).toBe(403);

    const withKey = await invokeHandler(publicSignageHandler, {
      method: 'GET',
      query: { id: workspaceId, format: 'LANDSCAPE', includeInactive: 'true', key: 'monitor-key' },
    });
    expect(withKey.status).toBe(200);
    expect(slideIdsOf(withKey.json)).toEqual([active.id, disabled.id, future.id]);
    expect(withKey.headers['Cache-Control']).toBe('private, no-store');
  });

  it('answers 405 for other methods and 400 for invalid queries', async () => {
    const { workspaceId } = await seedMonitor();
    expect((await invokeHandler(publicSignageHandler, { method: 'POST', query: { id: workspaceId } })).status).toBe(405);
    expect((await invokeHandler(publicSignageHandler, { method: 'GET', query: { id: workspaceId, format: 'SQUARE' } })).status).toBe(400);
  });

  // Last: drains the per-IP bucket of this module instance.
  it('rate limits per client address', async () => {
    const { workspaceId } = await seedMonitor();
    const statuses: number[] = [];
    for (let i = 0; i < 70; i++) {
      statuses.push((await invokeHandler(publicSignageHandler, { method: 'GET', query: { id: workspaceId } })).status);
    }
    expect(statuses).toContain(429);
  });
});
