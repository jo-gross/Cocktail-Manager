import { describe, expect, it } from 'vitest';
import { createRun, getRunStep, getStepRoute, isOnRoute, reduceTourRun, resolveRoute, type TourRun } from '../engine';
import type { TourDefinition } from '../types';

const tour: TourDefinition = {
  id: 'demo',
  version: 1,
  category: 'basics',
  minRole: 'USER',
  title: 'basicsBar.title',
  description: 'basicsBar.description',
  steps: [
    { id: 'a', kind: 'info', route: '/workspaces/[workspaceId]', title: 'basicsBar.title', body: 'basicsBar.title' },
    { id: 'b', kind: 'highlight', target: 'bar.search', hideOn: 'mobile', title: 'basicsBar.title', body: 'basicsBar.title' },
    { id: 'c', kind: 'highlight', target: 'bar.queue', route: '/workspaces/[workspaceId]/manage', title: 'basicsBar.title', body: 'basicsBar.title' },
    { id: 'd', kind: 'highlight', target: 'bar.viewOptions', title: 'basicsBar.title', body: 'basicsBar.title' },
  ],
};

const start = (stepIndex = 0) => createRun(tour, { isMobile: false, workspaceId: 'ws1', stepIndex })!;

describe('createRun', () => {
  it('leaves out mobile-hidden steps on small screens', () => {
    expect(createRun(tour, { isMobile: true, workspaceId: null })!.stepIds).toEqual(['a', 'c', 'd']);
    expect(start().stepIds).toEqual(['a', 'b', 'c', 'd']);
  });

  it('clamps the start step', () => {
    expect(start(99).stepIndex).toBe(3);
    expect(start(-1).stepIndex).toBe(0);
  });
});

describe('reduceTourRun', () => {
  it('walks forward and completes after the last step', () => {
    let run: TourRun = start();
    for (const expected of [1, 2, 3]) {
      run = reduceTourRun(run, { type: 'next' }).run!;
      expect(run.stepIndex).toBe(expected);
    }
    expect(reduceTourRun(run, { type: 'next' })).toEqual({ run: null, finished: 'COMPLETED' });
  });

  it('goes back over visited steps only (skipped steps are left out)', () => {
    let run = reduceTourRun(start(), { type: 'next' }).run!; // b
    run = reduceTourRun(run, { type: 'skip' }).run!; // b missing → c
    expect(run.stepIndex).toBe(2);
    run = reduceTourRun(run, { type: 'back' }).run!;
    expect(run.stepIndex).toBe(0);
    expect(run.direction).toBe(-1);
    // Nothing visited before the first step
    expect(reduceTourRun(run, { type: 'back' }).run).toBe(run);
  });

  it('skips backwards when going back to a step whose target is missing', () => {
    let run = start();
    run = reduceTourRun(run, { type: 'next' }).run!; // b
    run = reduceTourRun(run, { type: 'next' }).run!; // c
    run = reduceTourRun(run, { type: 'back' }).run!; // b, target gone now
    run = reduceTourRun(run, { type: 'skip' }).run!;
    expect(run.stepIndex).toBe(0);
  });

  it('finishes when the last step is skipped', () => {
    const run = reduceTourRun(start(2), { type: 'next' }).run!; // d (visited c)
    expect(reduceTourRun(run, { type: 'skip' }).finished).toBe('COMPLETED');
    // Nothing shown at all → not completed
    expect(reduceTourRun(start(3), { type: 'skip' }).finished).toBe('DISMISSED');
  });

  it('ends as dismissed', () => {
    expect(reduceTourRun(start(1), { type: 'end' })).toEqual({ run: null, finished: 'DISMISSED' });
  });

  it('resolves the current step', () => {
    expect(getRunStep(tour, start(2))?.id).toBe('c');
  });
});

describe('routes', () => {
  it('inherits the route of the previous step', () => {
    expect(getStepRoute(tour, 'b')).toBe('/workspaces/[workspaceId]');
    expect(getStepRoute(tour, 'd')).toBe('/workspaces/[workspaceId]/manage');
  });

  it('fills the workspace placeholder', () => {
    expect(resolveRoute('/workspaces/[workspaceId]/manage', 'a b')).toBe('/workspaces/a%20b/manage');
    expect(resolveRoute('/workspaces/[workspaceId]', null)).toBeNull();
    expect(resolveRoute('/', null)).toBe('/');
  });

  it('matches the current path ignoring query, hash and trailing slash', () => {
    expect(isOnRoute('/workspaces/ws1?card=search', '/workspaces/[workspaceId]', 'ws1')).toBe(true);
    expect(isOnRoute('/workspaces/ws1/manage/#top', '/workspaces/[workspaceId]/manage', 'ws1')).toBe(true);
    expect(isOnRoute('/workspaces/ws1/manage/cards', '/workspaces/[workspaceId]/manage', 'ws1')).toBe(false);
    expect(isOnRoute('/workspaces/ws2', '/workspaces/[workspaceId]', 'ws1')).toBe(false);
  });
});
