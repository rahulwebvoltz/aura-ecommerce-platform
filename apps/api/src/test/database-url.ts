/**
 * Resolves the integration-test database: the `DATABASE_URL` database with `_test` appended
 * (e.g. `ecommerce` → `ecommerce_test`). Tests truncate every table, so the result must always
 * name a `_test` database and never the development one.
 */
export function testDatabaseUrl(): string {
  if (process.env['DATABASE_URL'] === undefined) {
    try {
      process.loadEnvFile('.env');
    } catch {
      // Fall through to the explicit error below.
    }
  }

  const url = URL.parse(process.env['DATABASE_URL'] ?? '');
  const databaseName = url?.pathname.replace(/^\//u, '') ?? '';
  if (url === null || databaseName === '') {
    throw new Error('DATABASE_URL is required to run the API integration tests.');
  }

  url.pathname = `/${databaseName.endsWith('_test') ? databaseName : `${databaseName}_test`}`;
  return url.toString();
}
