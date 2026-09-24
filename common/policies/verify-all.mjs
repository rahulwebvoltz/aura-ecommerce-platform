#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const includeSecurityAudit = process.argv.includes('--security');

const stacks = [
  {
    buildFailurePattern: /Cannot resolve entry module index\.html/u,
    directory: 'react',
  },
  {
    directory: 'nextjs',
  },
  {
    directory: 'nodejs-backend',
  },
];

function runNpmScript(stackDirectory, scriptName) {
  const result = spawnSync(npmCommand, ['run', scriptName], {
    cwd: path.join(repositoryRoot, stackDirectory),
    encoding: 'utf8',
    stdio: 'pipe',
  });
  const output = `${result.stdout}${result.stderr}`;

  process.stdout.write(output);
  return { output, status: result.status };
}

for (const stack of stacks) {
  process.stdout.write(`\n=== ${stack.directory}: quality ===\n`);
  const quality = runNpmScript(stack.directory, 'quality');
  if (quality.status !== 0) {
    process.exit(quality.status ?? 1);
  }

  process.stdout.write(`\n=== ${stack.directory}: tests ===\n`);
  const tests = runNpmScript(stack.directory, 'test');
  if (tests.status !== 0) {
    process.exit(tests.status ?? 1);
  }

  if (includeSecurityAudit) {
    process.stdout.write(`\n=== ${stack.directory}: dependency audit ===\n`);
    const audit = runNpmScript(stack.directory, 'security:audit');
    if (audit.status !== 0) {
      process.exit(audit.status ?? 1);
    }
  }

  process.stdout.write(`\n=== ${stack.directory}: build ===\n`);
  const build = runNpmScript(stack.directory, 'build');
  if (stack.buildFailurePattern === undefined) {
    if (build.status !== 0) {
      process.exit(build.status ?? 1);
    }
  } else if (build.status === 0 || !stack.buildFailurePattern.test(build.output)) {
    process.stderr.write(
      `${stack.directory} did not stop at its documented empty-scaffold build boundary.\n`,
    );
    process.exit(1);
  }
}

process.stdout.write('\nAll engineering standards verification gates passed.\n');
