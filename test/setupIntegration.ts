import { config } from 'dotenv';
import { resolve } from 'node:path';
import { beforeEach } from 'vitest';
import { truncateAllTables } from './helpers/dbFixtures';

config({ path: resolve(process.cwd(), '.env.test') });

process.env.NODE_ENV = 'test';
process.env.BETTER_AUTH_SECRET ??= 'test-better-auth-secret';
process.env.API_KEY_JWT_SECRET ??= 'test-jwt-secret-for-api-tests';
process.env.INSTANCE_MASTER_API_KEY ??= 'ck_master_test_key_1234567890';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

beforeEach(async () => {
  await truncateAllTables();
});
