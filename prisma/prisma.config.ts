import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile('.env');
} catch {
  // A local .env file is optional; CI and production provide real environment variables.
}

// `prisma generate` never connects, so a placeholder keeps generation working without a database.
const generateOnlyUrl = 'postgresql://generate-only@localhost:5432/unused';

export default defineConfig({
  schema: 'schema.prisma',
  migrations: {
    path: 'migrations',
    seed: 'tsx --conditions=development seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'] ?? generateOnlyUrl,
  },
});
