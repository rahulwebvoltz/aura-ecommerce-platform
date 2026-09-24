import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    env: {
      VITE_API_BASE_URL: 'http://api.example.test',
      VITE_APP_ENV: 'test',
    },
    coverage: {
      exclude: ['src/**/*.test.*', 'src/test/**'],
      // Thresholds cover the storefront's logic layer: configuration, the API client, stores,
      // hooks, and formatting helpers. Components are exercised by behaviour tests.
      include: [
        'src/lib/**/*.ts',
        'src/services/**/*.ts',
        'src/stores/**/*.ts',
        'src/hooks/**/*.ts',
      ],
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
