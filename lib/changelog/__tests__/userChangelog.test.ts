import { describe, expect, it } from 'vitest';
import { addReleaseEntry, compareVersions, extractHighlights, getUnseenEntries, type UserChangelogEntry } from '../userChangelog';

const releaseBody = [
  "## What's Changed",
  '',
  '## New Features',
  '',
  '- feat: guest menus with card designer (#1450) @jo-gross',
  '- feat(api)!: versioned API (#1256) @jo-gross',
  '',
  '## Dependencies',
  '',
  '- build(deps): bump nodemailer from 10.3.1 to 10.4.0 (#1452) @[dependabot[bot]](https://github.com/apps/dependabot)',
  '- fix(deps): update nextjs monorepo to v16.2.1 (#982) @[renovate[bot]](https://github.com/apps/renovate)',
  '',
  '## Bug Fixes',
  '',
  '- fix: unit conversion for \\<garnish> \\_edit\\_ (#1437) @jo-gross',
  '',
  '## Other Changes',
  '',
  '- chore: replaced nextPWA with serwist (#934) @jo-gross',
  '- update readme (#900) @jo-gross',
  '',
  '**Full Changelog**: https://github.com/jo-gross/Cocktail-Manager/compare/v1.21.3...v1.22.0',
].join('\n');

const entries: UserChangelogEntry[] = [
  { version: '1.22.0', date: '2026-11-12', highlights: ['C'] },
  { version: '1.21.3', date: '2026-11-10', highlights: ['B'] },
  { version: '1.20.1', date: '2026-02-22', highlights: ['A'] },
];

describe('compareVersions', () => {
  it('compares numerically per component', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('1.2.3', '2.0.0')).toBeLessThan(0);
  });
});

describe('extractHighlights', () => {
  it('keeps features and bug fixes, skips dependency updates and other changes', () => {
    expect(extractHighlights(releaseBody)).toEqual(['Guest menus with card designer', 'Versioned API', 'Bug fix: Unit conversion for <garnish> _edit_']);
  });

  it('returns nothing for dependency-only releases', () => {
    expect(extractHighlights('- build(deps): bump a from 1 to 2 (#1) @[dependabot[bot]](https://x)')).toEqual([]);
  });
});

describe('addReleaseEntry', () => {
  it('adds the release as newest entry', () => {
    const result = addReleaseEntry(entries, { version: '1.23.0', date: '2026-12-01', body: releaseBody });
    expect(result[0]).toEqual({ version: '1.23.0', date: '2026-12-01', highlights: expect.arrayContaining(['Versioned API']) });
    expect(result).toHaveLength(4);
  });

  it('keeps entries unchanged without highlights or for known versions', () => {
    expect(addReleaseEntry(entries, { version: '1.23.0', date: '2026-12-01', body: '' })).toBe(entries);
    expect(addReleaseEntry(entries, { version: '1.22.0', date: '2026-12-01', body: releaseBody })).toBe(entries);
  });
});

describe('getUnseenEntries', () => {
  it('returns entries newer than the last seen version up to the current version', () => {
    expect(getUnseenEntries(entries, '1.22.1', '1.20.1').map((e) => e.version)).toEqual(['1.22.0', '1.21.3']);
    expect(getUnseenEntries(entries, '1.21.3', '1.20.1').map((e) => e.version)).toEqual(['1.21.3']);
  });

  it('returns nothing when the user has seen everything', () => {
    expect(getUnseenEntries(entries, '1.22.1', '1.22.0')).toEqual([]);
    expect(getUnseenEntries(entries, '1.22.1', '1.22.1')).toEqual([]);
  });

  it('returns only the latest entry for users without a last seen version', () => {
    expect(getUnseenEntries(entries, '1.22.1').map((e) => e.version)).toEqual(['1.22.0']);
  });
});
