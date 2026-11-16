import { describe, expect, it } from 'vitest';
import de from '../../../locales/de/tours.json';
import en from '../../../locales/en/tours.json';
import { defineTour, validateTour } from '../defineTour';
import { getAnnouncedTours, getTourStatus, getUnseenFeatureTours, TOURS, tourGuideId, type GuideProgress } from '../registry';
import type { TourDefinition } from '../types';

function lookup(resources: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), resources);
}

const tour = (overrides: Partial<TourDefinition> = {}): TourDefinition =>
  defineTour({
    id: 'feature-x',
    version: 1,
    category: 'feature',
    minRole: 'USER',
    title: 'basicsBar.title',
    description: 'basicsBar.description',
    steps: [{ id: 'one', kind: 'info', route: '/workspaces/[workspaceId]', title: 'basicsBar.title', body: 'basicsBar.description' }],
    ...overrides,
  } as TourDefinition);

const progress = (entries: Partial<GuideProgress>[]): Record<string, GuideProgress> =>
  Object.fromEntries(entries.map((entry) => [entry.guideId!, { status: 'STARTED', version: 1, updatedAt: '2026-01-01T00:00:00Z', ...entry } as GuideProgress]));

describe('tour registry', () => {
  it.each(TOURS.map((definition) => [definition.id, definition]))('%s is valid', (_id, definition) => {
    expect(validateTour(definition)).toEqual([]);
  });

  it('has unique tour ids', () => {
    const ids = TOURS.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has all texts in de and en', () => {
    for (const definition of TOURS) {
      const keys = [definition.title, definition.description, ...definition.steps.flatMap((step) => [step.title, step.body])];
      for (const key of keys) {
        expect(typeof lookup(de, key), `de: ${key}`).toBe('string');
        expect(typeof lookup(en, key), `en: ${key}`).toBe('string');
      }
    }
  });

  it('reports structural problems', () => {
    const broken = tour({
      id: 'Bad_Id',
      version: 0,
      announce: { since: 'next' },
      steps: [
        { id: 'a', kind: 'highlight', title: 'basicsBar.title', body: 'basicsBar.title', target: 'nope' as never },
        { id: 'a', kind: 'action', target: 'bar.search', advanceOn: { route: 'manage?x' }, title: 'basicsBar.title', body: 'basicsBar.title' },
      ],
    });
    const errors = validateTour(broken).join('\n');
    expect(errors).toContain('kebab case');
    expect(errors).toContain('positive integer');
    expect(errors).toContain('announce.since');
    expect(errors).toContain('unknown target "nope"');
    expect(errors).toContain('duplicate step id');
    expect(errors).toContain('advanceOn.route');
    expect(errors).toContain('first step needs a route');
  });
});

describe('tour status', () => {
  const definition = tour({ version: 2 });

  it('is NEW without progress', () => {
    expect(getTourStatus(definition, {})).toBe('NEW');
  });

  it('treats a completed older version as NEW', () => {
    expect(getTourStatus(definition, progress([{ guideId: tourGuideId('feature-x'), status: 'COMPLETED', version: 1 }]))).toBe('NEW');
    expect(getTourStatus(definition, progress([{ guideId: tourGuideId('feature-x'), status: 'COMPLETED', version: 2 }]))).toBe('COMPLETED');
    expect(getTourStatus(definition, progress([{ guideId: tourGuideId('feature-x'), status: 'DISMISSED', version: 1 }]))).toBe('DISMISSED');
  });
});

describe('announcements', () => {
  const older = tour({ id: 'older', announce: { since: '1.20.0' } });
  const newer = tour({ id: 'newer', announce: { since: '1.22.0', highlight: 'manage.cards' } });
  const future = tour({ id: 'future', announce: { since: '1.23.0' } });
  const basics = tour({ id: 'basics', category: 'basics' });
  const all = [older, newer, future, basics];

  it('lists released tours after the last seen version, newest first', () => {
    expect(getAnnouncedTours(all, '1.22.0', '1.19.0').map((t) => t.id)).toEqual(['newer', 'older']);
    expect(getAnnouncedTours(all, '1.22.0', '1.21.0').map((t) => t.id)).toEqual(['newer']);
    expect(getAnnouncedTours(all, '1.22.0', '1.22.0')).toEqual([]);
    expect(getAnnouncedTours(all, '1.22.0', null).map((t) => t.id)).toEqual(['newer', 'older']);
  });

  it('keeps the "Neu" badge until the tour was opened or dismissed', () => {
    expect(getUnseenFeatureTours(all, {}).map((t) => t.id)).toEqual(['older', 'newer', 'future']);
    expect(getUnseenFeatureTours(all, progress([{ guideId: 'tour:newer', status: 'DISMISSED' }, { guideId: 'tour:older' }])).map((t) => t.id)).toEqual([
      'future',
    ]);
  });
});
