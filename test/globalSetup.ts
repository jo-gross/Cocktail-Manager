import { config } from 'dotenv';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { CoverageRecord } from './helpers/apiCoverage';

const COVERAGE_ALLOWLIST = resolve(process.cwd(), 'test/api-coverage-allowlist.json');

export async function setup() {
  config({ path: resolve(process.cwd(), '.env.test') });

  process.env.BETTER_AUTH_SECRET ??= 'test-better-auth-secret';
  process.env.API_KEY_JWT_SECRET ??= 'test-jwt-secret-for-api-tests';
  process.env.INSTANCE_MASTER_API_KEY ??= 'ck_master_test_key_1234567890';
  process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set for integration tests (see .env.test)');
  }

  // Parallel runs against separate databases share generated/; let them skip regeneration.
  if (!process.env.SKIP_PRISMA_GENERATE) execSync('pnpm prisma generate', { stdio: 'inherit', env: process.env });
  execSync('pnpm prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
  });

  // Operation coverage: workers append invocations here (see test/helpers/apiCoverage.ts).
  if (process.env.API_COVERAGE_ENFORCE) {
    process.env.API_COVERAGE_FILE = resolve(tmpdir(), `api-coverage-${process.pid}.ndjson`);
    writeFileSync(process.env.API_COVERAGE_FILE, '');
  }
}

/**
 * With API_COVERAGE_ENFORCE=1 (CI, full run): every documented v1 operation must
 * have been answered with a 2xx at least once, unless listed in
 * test/api-coverage-allowlist.json. Fails the run otherwise.
 */
export async function teardown() {
  const file = process.env.API_COVERAGE_FILE;
  if (!process.env.API_COVERAGE_ENFORCE || !file || !existsSync(file)) return;

  const { flattenOperations } = await import('../lib/openapi/flattenOperations');
  const records = readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CoverageRecord);
  const succeeded = new Set(records.filter((r) => r.status >= 200 && r.status < 300).map((r) => `${r.method} ${r.basePath}`));
  const allowlist: string[] = existsSync(COVERAGE_ALLOWLIST) ? JSON.parse(readFileSync(COVERAGE_ALLOWLIST, 'utf8')) : [];

  const operations = (await flattenOperations()).map((op) => `${op.method} ${op.basePath}`);
  const uncovered = operations.filter((op) => !succeeded.has(op) && !allowlist.includes(op));
  const nowCovered = allowlist.filter((op) => succeeded.has(op));

  console.info(
    `[api-coverage] ${operations.length - operations.filter((op) => !succeeded.has(op)).length}/${operations.length} operations exercised with a 2xx response.`,
  );
  if (nowCovered.length > 0) console.info(`[api-coverage] Covered now, remove from the allowlist:\n  ${nowCovered.join('\n  ')}`);
  if (uncovered.length > 0) {
    throw new Error(`[api-coverage] Operations without a successful integration test call:\n  ${uncovered.join('\n  ')}`);
  }
}
