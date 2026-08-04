import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['lib/**/*.integration.test.{ts,tsx}'],
    exclude: ['**/node_modules/**'],
    globalSetup: ['./test/globalSetup.ts'],
    setupFiles: ['./test/setupIntegration.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
  resolve: {
    alias: {
      '@lib': path.resolve(__dirname, 'lib'),
      '@components': path.resolve(__dirname, 'components'),
      '@middleware': path.resolve(__dirname, 'middleware'),
      '@generated': path.resolve(__dirname, 'generated'),
      '@test': path.resolve(__dirname, 'test'),
    },
  },
});
