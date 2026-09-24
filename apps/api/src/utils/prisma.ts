import { Prisma } from '@ecommerce/db';

/** True when Prisma reports a unique-constraint violation. */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** True when Prisma reports that a required record was not found. */
export function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

/** Reads a count out of a Prisma `groupBy` `_count` result, whose static type is loose. */
export function groupCount(count: unknown, key = '_all'): number {
  if (typeof count === 'object' && count !== null && key in count) {
    const value: unknown = Reflect.get(count, key);
    return typeof value === 'number' ? value : 0;
  }

  return 0;
}
