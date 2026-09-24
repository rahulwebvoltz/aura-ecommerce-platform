import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { createTypeScriptConfig } from '../common/eslint/typescript.mjs';

export default defineConfig(
  // Documented exception: the Prisma client is regenerated on install, is never committed, and
  // ships its own eslint-disable/ts-nocheck headers that cannot be turned off. See README.md.
  globalIgnores(['dist/**', 'coverage/**', 'generated/**']),
  {
    files: ['**/*.{cjs,cts,js,mjs,mts,ts}'],
    extends: [eslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-console': 'off',
    },
  },
  createTypeScriptConfig({ tseslint, tsconfigRootDir: import.meta.dirname }),
  {
    files: ['**/*.{cjs,js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
