import { describe, expect, it } from 'vitest';
import { checkTours, collectAnchors, collectRegistryRefs, flattenKeys } from '../../../scripts/check-tour-targets.mjs';
import { shouldShowChecklistCard, summarizeChecklist, checklistItemHref } from '../checklist';
import { mergeProgress } from '../storage';

describe('check-tour-targets', () => {
  const definition = {
    file: 'lib/tours/definitions/x.ts',
    content: [
      "  title: 'x.title',",
      "  steps: [{ id: 'a', kind: 'highlight', target: 'bar.search', title: 'x.steps.a.title', body: 'x.steps.a.body' }],",
      "  announce: { since: '1.0.0', highlight: 'manage.cards' },",
    ].join('\n'),
  };

  it('collects targets and text keys with their position', () => {
    const refs = collectRegistryRefs([definition]);
    expect(refs.targets.map((target: { id: string }) => target.id)).toEqual(['bar.search', 'manage.cards']);
    expect(refs.textKeys.map((key: { key: string }) => key.key)).toEqual(['x.title', 'x.steps.a.title', 'x.steps.a.body']);
    expect(refs.targets[0].line).toBe(2);
  });

  it('finds anchors set via helper or prop', () => {
    const anchors = collectAnchors([
      { file: 'a.tsx', content: "<div {...tourTarget('bar.search')} />" },
      { file: 'b.tsx', content: '<ManageLink tourTarget="manage.cards" />' },
    ]);
    expect([...anchors].sort()).toEqual(['bar.search', 'manage.cards']);
  });

  it('reports missing anchors and texts per locale', () => {
    const refs = collectRegistryRefs([definition]);
    const keys = new Set(['x.title', 'x.steps.a.title', 'x.steps.a.body']);
    expect(checkTours(refs, new Set(['bar.search', 'manage.cards']), { de: keys, en: keys })).toEqual([]);

    const errors = checkTours(refs, new Set(['bar.search']), { de: keys, en: new Set(['x.title']) });
    expect(errors).toHaveLength(3);
    expect(errors[0]).toContain('"manage.cards" is not set anywhere');
    expect(errors[1]).toContain('tours:x.steps.a.title" is missing in locales/en');
  });

  it('flattens nested locale keys', () => {
    expect(flattenKeys({ a: { b: 'x', c: { d: 'y' } }, e: 'z' })).toEqual(['a.b', 'a.c.d', 'e']);
  });
});

describe('checklist', () => {
  const items = [
    { id: 'glasses' as const, done: true, open: 0 },
    { id: 'cocktails' as const, done: false, open: 2 },
    { id: 'unknownFromNewerServer' as never, done: false, open: 1 },
  ];

  it('summarizes known items', () => {
    expect(summarizeChecklist(items)).toEqual({ done: 1, total: 2, next: items[1], complete: false });
    expect(checklistItemHref('ws', 'team')).toBe('/workspaces/ws/manage/settings/users');
  });

  it('shows the progress card only after the wizard, while open and not dismissed', () => {
    const status = { setupCompletedAt: '2026-11-15T00:00:00Z', checklist: items };
    expect(shouldShowChecklistCard(status, false)).toBe(true);
    expect(shouldShowChecklistCard(status, true)).toBe(false);
    expect(shouldShowChecklistCard({ ...status, setupCompletedAt: null }, false)).toBe(false);
    expect(shouldShowChecklistCard({ ...status, checklist: [{ id: 'glasses' as const, done: true, open: 0 }] }, false)).toBe(false);
    expect(shouldShowChecklistCard(null, false)).toBe(false);
  });
});

describe('mergeProgress', () => {
  it('lets the server win and keeps local-only entries as unsynced', () => {
    const local = {
      'tour:a': { guideId: 'tour:a', status: 'COMPLETED' as const, version: 1, updatedAt: '2026-11-15T10:00:00Z' },
      'tour:b': { guideId: 'tour:b', status: 'STARTED' as const, version: 1, updatedAt: '2026-11-15T10:00:00Z' },
    };
    const merged = mergeProgress(
      [
        { guideId: 'tour:a', status: 'STARTED', version: 1, updatedAt: '2026-11-15T09:00:00Z' },
        { guideId: 'tour:b', status: 'DISMISSED', version: 1, updatedAt: '2026-11-15T11:00:00Z' },
        { guideId: 'tour:c', status: 'STARTED', version: 1, updatedAt: '2026-11-15T11:00:00Z' },
      ],
      { ...local, 'tour:d': { guideId: 'tour:d', status: 'STARTED' as const, version: 1, updatedAt: '2026-11-15T12:00:00Z' } },
    );
    // Server wins even when the local entry is newer
    expect(merged.merged['tour:a'].status).toBe('STARTED');
    expect(merged.merged['tour:b'].status).toBe('DISMISSED');
    expect(merged.merged['tour:c'].status).toBe('STARTED');
    expect(merged.merged['tour:d'].status).toBe('STARTED');
    expect(merged.unsynced.map((entry) => entry.guideId)).toEqual(['tour:d']);
  });
});
