import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['lib/**/*.test.{ts,tsx}', 'middleware/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/*.integration.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['lib/**', 'models/**', 'middleware/**'],
    },
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
