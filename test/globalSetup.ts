import { config } from 'dotenv';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

export async function setup() {
  config({ path: resolve(process.cwd(), '.env.test') });

  process.env.BETTER_AUTH_SECRET ??= 'test-better-auth-secret';
  process.env.API_KEY_JWT_SECRET ??= 'test-jwt-secret-for-api-tests';
  process.env.INSTANCE_MASTER_API_KEY ??= 'ck_master_test_key_1234567890';
  process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set for integration tests (see .env.test)');
  }

  execSync('pnpm prisma generate', { stdio: 'inherit', env: process.env });
  execSync('pnpm prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
  });
}

export async function teardown() {
  // No global teardown required — per-test truncation handles isolation.
}
