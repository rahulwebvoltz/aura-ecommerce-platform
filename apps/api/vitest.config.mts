import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['development'],
  },
  ssr: {
    resolve: {
      conditions: ['development'],
    },
  },
  test: {
    environment: 'node',
    globalSetup: ['src/test/global-setup.ts'],
    // Integration suites share one PostgreSQL test database, so files run one at a time.
    fileParallelism: false,
    // Prisma's WASM query compiler plus V8 coverage instrumentation needs more than the default heap.
    execArgv: ['--max-old-space-size=4096'],
    hookTimeout: 60_000,
    testTimeout: 30_000,
    coverage: {
      exclude: ['src/**/*.test.*', 'src/test/**', 'src/index.ts'],
      include: ['src/**/*.ts'],
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
