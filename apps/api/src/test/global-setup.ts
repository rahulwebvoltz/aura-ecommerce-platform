import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { testDatabaseUrl } from './database-url.js';

const prismaDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../prisma',
);

/** Applies every migration to the test database once before the suites run. */
export default function setup(): void {
  // A fixed command string: nothing user-controlled is interpolated into the shell.
  const result = spawnSync('npx prisma migrate deploy', {
    cwd: prismaDirectory,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    encoding: 'utf8',
    shell: true,
  });

  if (result.status !== 0) {
    process.stderr.write(result.stdout + result.stderr);
    throw new Error('Failed to migrate the test database.');
  }
}
