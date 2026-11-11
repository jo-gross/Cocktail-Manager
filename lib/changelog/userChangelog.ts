export interface UserChangelogEntry {
  version: string;
  date: string;
  highlights: string[];
}

const DEPENDENCY_SCOPES = ['deps', 'deps-dev'];

/** Compares `major.minor.patch` versions, returns a negative number if `a` is older than `b`. */
export function compareVersions(a: string, b: string): number {
  const partsA = a.replace(/^v/, '').split('.').map(Number);
  const partsB = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Extracts user facing highlights (features and bug fixes) from release drafter notes.
 * Entries look like `- feat(scope): title (#123) @author`; dependency updates are skipped.
 */
export function extractHighlights(releaseBody: string): string[] {
  const highlights: string[] = [];
  for (const line of releaseBody.split(/\r?\n/)) {
    const entry = line.match(/^\s*[-*]\s+(.+?)\s+\(#\d+\)/);
    if (!entry) continue;
    // Undo release drafter's `change-title-escapes`
    const title = entry[1].replace(/\\([\\<*_&])/g, '$1');
    const conventional = title.match(/^(\w+)(?:\(([^)]*)\))?!?:\s*(.+)$/);
    if (!conventional) continue;
    const [, type, scope, description] = conventional;
    if (scope && DEPENDENCY_SCOPES.includes(scope)) continue;
    if (type === 'feat') highlights.push(capitalize(description));
    if (type === 'fix') highlights.push(`Bug fix: ${capitalize(description)}`);
  }
  return [...new Set(highlights)];
}

/** Adds an entry for the release, unless it has no highlights or the version is already listed. */
export function addReleaseEntry(entries: UserChangelogEntry[], release: { version: string; date: string; body: string }): UserChangelogEntry[] {
  if (entries.some((entry) => entry.version === release.version)) return entries;
  const highlights = extractHighlights(release.body);
  if (highlights.length === 0) return entries;
  return [{ version: release.version, date: release.date, highlights }, ...entries].sort((a, b) => compareVersions(b.version, a.version));
}

/**
 * Entries released after the last version the user has seen, newest first.
 * Users without a last seen version only get the latest entry.
 */
export function getUnseenEntries(entries: UserChangelogEntry[], currentVersion: string, lastSeenVersion?: string | null): UserChangelogEntry[] {
  const released = entries.filter((entry) => compareVersions(entry.version, currentVersion) <= 0).sort((a, b) => compareVersions(b.version, a.version));
  if (!lastSeenVersion) return released.slice(0, 1);
  return released.filter((entry) => compareVersions(entry.version, lastSeenVersion) > 0);
}
