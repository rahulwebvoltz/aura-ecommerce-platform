import { defineConfig } from 'vitest/config';

// Repository-level policy checks. Each workspace has its own Vitest configuration.
export default defineConfig({
  test: {
    include: ['scripts/**/*.test.mjs'],
    testTimeout: 60_000,
  },
});
