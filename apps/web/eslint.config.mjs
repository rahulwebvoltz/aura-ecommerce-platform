import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { createTypeScriptConfig } from '../../common/eslint/typescript.mjs';

const sourceFiles = ['**/*.{cjs,cts,js,jsx,mjs,mts,ts,tsx}'];

export default defineConfig(
  globalIgnores(['dist/**', 'coverage/**']),
  {
    files: sourceFiles,
    extends: [
      eslint.configs.recommended,
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      reactHooks.configs.flat.recommended,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react/prop-types': 'off',
    },
  },
  createTypeScriptConfig({ tseslint, tsconfigRootDir: import.meta.dirname }),
  prettier,
);
