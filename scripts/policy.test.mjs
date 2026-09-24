import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

import { assertTypeAwareEslintConfig } from '../common/policies/assert-config.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const tsc = require.resolve('typescript/bin/tsc');
const strict = JSON.parse(readFileSync(path.join(root, 'common/tsconfig/strict.json'), 'utf8'));

const WORKSPACES = [
  { dir: 'packages/shared', probes: ['src/policy-probe.ts', 'src/generated/policy-probe.ts'] },
  { dir: 'packages/types', probes: ['src/policy-probe.ts', 'src/policy-probe.generated.ts'] },
  { dir: 'packages/validation', probes: ['src/policy-probe.ts', 'src/policy-probe.mts'] },
  {
    dir: 'prisma',
    probes: ['src/policy-probe.ts', 'seeds/policy-probe.ts', 'src/generated/policy-probe.ts'],
  },
  {
    dir: 'apps/api',
    probes: ['src/policy-probe.ts', 'src/policy-probe.cts', 'src/generated/policy-probe.ts'],
  },
  {
    dir: 'apps/web',
    probes: ['src/policy-probe.ts', 'src/policy-probe.tsx', 'src/generated/policy-probe.ts'],
  },
];

describe.each(WORKSPACES)('$dir engineering policy', ({ dir, probes }) => {
  const workspace = path.join(root, dir);
  const eslint = new ESLint({ cwd: workspace });

  it.each(probes)('enforces the complete typed ESLint policy for %s', async (probe) => {
    const config = await eslint.calculateConfigForFile(path.join(workspace, probe));
    assertTypeAwareEslintConfig(config, `${dir}/${probe}`);
  });

  it('inherits every strict TypeScript option from common/', () => {
    const rendered = JSON.parse(
      execFileSync(
        process.execPath,
        [tsc, '--showConfig', '--project', path.join(workspace, 'tsconfig.json')],
        {
          encoding: 'utf8',
        },
      ),
    );
    for (const [option, expected] of Object.entries(strict.compilerOptions)) {
      expect(rendered.compilerOptions[option], `${dir}: ${option}`).toBe(expected);
    }
  });
});

describe('repository pipeline', () => {
  it('runs every standard security, quality, and delivery job in GitHub Actions', () => {
    const workflow = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');

    for (const snippet of [
      'secret-scan:',
      'dependency-audit:',
      'quality:',
      'commitlint:',
      'test:',
      'build:',
      'gitleaks git --config .gitleaks.toml --redact',
      'npm audit --audit-level=high',
      'npm run quality',
      'commitlint --from',
      'npm test',
      'npm run build',
      'npm ci',
    ]) {
      expect(workflow).toContain(snippet);
    }
  });

  it('pins exact dependency versions in every manifest', () => {
    for (const manifest of [
      'package.json',
      ...WORKSPACES.map(({ dir }) => `${dir}/package.json`),
    ]) {
      const pkg = JSON.parse(readFileSync(path.join(root, manifest), 'utf8'));
      for (const [name, version] of Object.entries({
        ...pkg.dependencies,
        ...pkg.devDependencies,
      })) {
        expect(version, `${manifest}: ${name}`).toMatch(/^\d+\.\d+\.\d+$/u);
      }
    }
  });
});
