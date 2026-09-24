import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/client/client.js';

export * from '../generated/client/client.js';

export interface CreatePrismaClientOptions {
  databaseUrl: string;
  /** Emit query logs, useful while developing locally. */
  logQueries?: boolean;
}

/** Creates a Prisma client backed by the node-postgres driver adapter. */
export function createPrismaClient({
  databaseUrl,
  logQueries = false,
}: CreatePrismaClientOptions): PrismaClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl });

  return new PrismaClient({
    adapter,
    log: logQueries ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });
}

export type DatabaseClient = PrismaClient;
