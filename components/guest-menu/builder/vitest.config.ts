import { defineConfig } from 'vitest/config';
import baseConfig from '../../../vitest.config';

// Keep the focused component tests runnable without widening the repository's
// default (lib/middleware-only) test discovery.
export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['components/guest-menu/builder/__tests__/**/*.test.tsx'],
  },
});
