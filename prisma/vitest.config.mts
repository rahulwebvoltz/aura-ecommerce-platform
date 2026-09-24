import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['development'],
  },
  test: {
    coverage: {
      exclude: ['**/*.test.*'],
      include: ['src/**/*.ts', 'seeds/catalog-data.ts'],
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: {
        branches: 85,
        functions: 100,
        lines: 90,
        statements: 90,
      },
    },
  },
});
