// Adds the features and bug fixes of a release to public/user-changelog.json,
// which is shown to users after an update. Used by .github/workflows/release.yml.
//
// Usage: RELEASE_BODY=... VERSION=1.2.3 RELEASE_DATE=2026-01-01 tsx scripts/update-user-changelog.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { addReleaseEntry, type UserChangelogEntry } from '../lib/changelog/userChangelog';

const { RELEASE_BODY, VERSION, RELEASE_DATE } = process.env;
if (!VERSION) {
  console.error('VERSION is required');
  process.exit(1);
}

const filePath = join(process.cwd(), 'public', 'user-changelog.json');
const entries: UserChangelogEntry[] = JSON.parse(readFileSync(filePath, 'utf8'));
const updated = addReleaseEntry(entries, {
  version: VERSION,
  date: RELEASE_DATE || new Date().toISOString().slice(0, 10),
  body: RELEASE_BODY || '',
});

if (updated === entries) {
  console.log(`No user facing changes for ${VERSION}, user changelog unchanged.`);
} else {
  writeFileSync(filePath, `${JSON.stringify(updated, null, 2)}\n`);
  console.log(`Added ${VERSION} to user changelog:`, updated.find((entry) => entry.version === VERSION)?.highlights);
}
