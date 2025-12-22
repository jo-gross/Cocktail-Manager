import { defineConfig } from 'prisma/config';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env file from project root
config({ path: resolve(process.cwd(), '.env') });

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL || '',
  },
});
