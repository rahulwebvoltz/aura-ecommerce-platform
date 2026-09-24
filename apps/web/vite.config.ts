import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { pwa } from './pwa.config.js';

export default defineConfig({
  plugins: [react(), tailwindcss(), pwa()],
  resolve: {
    // One React instance for the app and every library that renders with it.
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2023',
    sourcemap: true,
  },
});
