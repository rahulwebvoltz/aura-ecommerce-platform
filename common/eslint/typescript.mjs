export const typescriptFiles = ['**/*.{ts,tsx,mts,cts}'];

export const requiredTypeAwareRules = [
  '@typescript-eslint/no-explicit-any',
  '@typescript-eslint/no-floating-promises',
  '@typescript-eslint/no-misused-promises',
  '@typescript-eslint/no-unsafe-argument',
  '@typescript-eslint/no-unsafe-assignment',
  '@typescript-eslint/no-unsafe-call',
  '@typescript-eslint/no-unsafe-declaration-merging',
  '@typescript-eslint/no-unsafe-enum-comparison',
  '@typescript-eslint/no-unsafe-function-type',
  '@typescript-eslint/no-unsafe-member-access',
  '@typescript-eslint/no-unsafe-return',
  '@typescript-eslint/no-unsafe-type-assertion',
  '@typescript-eslint/no-unsafe-unary-minus',
  '@typescript-eslint/only-throw-error',
  '@typescript-eslint/require-await',
  '@typescript-eslint/switch-exhaustiveness-check',
];

export function createTypeScriptConfig({ tseslint, tsconfigRootDir }) {
  const requiredRules = Object.fromEntries(
    requiredTypeAwareRules.map((ruleName) => [ruleName, 'error']),
  );

  return {
    files: typescriptFiles,
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
    rules: {
      ...requiredRules,
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          minimumDescriptionLength: 10,
          'ts-check': false,
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports', prefer: 'type-imports' },
      ],
    },
  };
}
