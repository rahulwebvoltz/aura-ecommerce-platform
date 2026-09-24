import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { requiredTypeAwareRules } from '../eslint/typescript.mjs';

const requiredCompilerOptions = {
  allowJs: false,
  allowUnreachableCode: false,
  allowUnusedLabels: false,
  alwaysStrict: true,
  checkJs: false,
  exactOptionalPropertyTypes: true,
  forceConsistentCasingInFileNames: true,
  isolatedModules: true,
  noFallthroughCasesInSwitch: true,
  noImplicitAny: true,
  noImplicitOverride: true,
  noImplicitReturns: true,
  noImplicitThis: true,
  noPropertyAccessFromIndexSignature: true,
  noUncheckedIndexedAccess: true,
  noUncheckedSideEffectImports: true,
  noUnusedLocals: true,
  noUnusedParameters: true,
  skipLibCheck: false,
  strict: true,
  strictBindCallApply: true,
  strictBuiltinIteratorReturn: true,
  strictFunctionTypes: true,
  strictNullChecks: true,
  strictPropertyInitialization: true,
  useUnknownInCatchVariables: true,
};

function severity(ruleSetting) {
  return Array.isArray(ruleSetting) ? ruleSetting[0] : ruleSetting;
}

export function assertTypeAwareEslintConfig(config, relativePath) {
  if (config === undefined) {
    throw new Error(`ESLint ignored required policy path: ${relativePath}`);
  }

  for (const ruleName of requiredTypeAwareRules) {
    if (severity(config.rules[ruleName]) !== 2) {
      throw new Error(`${relativePath} does not enforce ${ruleName} at error severity.`);
    }
  }

  if (severity(config.rules['@typescript-eslint/ban-ts-comment']) !== 2) {
    throw new Error(`${relativePath} does not enforce the TypeScript suppression policy.`);
  }
}

export function assertStrictTypeScriptConfig(stackRoot) {
  const typeScriptCli = path.join(stackRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  const renderedConfig = execFileSync(
    process.execPath,
    [typeScriptCli, '--showConfig', '--project', path.join(stackRoot, 'tsconfig.json')],
    { encoding: 'utf8' },
  );
  const parsedConfig = JSON.parse(renderedConfig);

  for (const [optionName, expectedValue] of Object.entries(requiredCompilerOptions)) {
    if (parsedConfig.compilerOptions[optionName] !== expectedValue) {
      throw new Error(
        `TypeScript option ${optionName} must resolve to ${String(expectedValue)}; received ${String(parsedConfig.compilerOptions[optionName])}.`,
      );
    }
  }
}

export function assertGitLabPolicy(stackRoot, expectedStackDirectory) {
  const repositoryRoot = path.dirname(stackRoot);
  const stackPipeline = readFileSync(path.join(stackRoot, '.gitlab-ci.yml'), 'utf8');
  const commonPipeline = readFileSync(
    path.join(repositoryRoot, 'common', 'gitlab', 'quality.yml'),
    'utf8',
  );

  const requiredStackSnippets = [
    'local: /common/gitlab/quality.yml',
    `STACK_DIR: ${expectedStackDirectory}`,
    'secret-scan:',
    'dependency-audit:',
    'quality:',
    'commitlint:',
    'test:',
    'build:',
  ];
  const requiredCommonSnippets = [
    'gitleaks git',
    'npm audit --audit-level=high',
    'npm run quality',
    'commitlint --from',
    'npm test',
    'npm run build',
  ];

  for (const snippet of requiredStackSnippets) {
    if (!stackPipeline.includes(snippet)) {
      throw new Error(`Stack pipeline is missing required policy: ${snippet}`);
    }
  }

  for (const snippet of requiredCommonSnippets) {
    if (!commonPipeline.includes(snippet)) {
      throw new Error(`Common pipeline is missing required policy: ${snippet}`);
    }
  }
}
