import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';

// Workspaces own their lint configuration; the root only covers repository-level scripts.
export default defineConfig(
  globalIgnores(['apps/**', 'packages/**', 'prisma/**', 'coverage/**']),
  {
    files: ['**/*.{cjs,js,mjs}'],
    extends: [eslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
  prettier,
);
