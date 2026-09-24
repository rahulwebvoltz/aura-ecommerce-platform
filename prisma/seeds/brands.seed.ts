import type { PrismaClient } from '../src/index.js';
import { catalogSnapshot } from './catalog-data.js';

/** Seeds brands and returns brand ids keyed by slug. */
export async function seedBrands(prisma: PrismaClient): Promise<Map<string, string>> {
  const created = await prisma.brand.createManyAndReturn({
    data: catalogSnapshot.brands.map((brand) => ({
      name: brand.name,
      slug: brand.slug,
      description: `Discover the latest from ${brand.name}.`,
    })),
    select: { id: true, slug: true },
  });

  return new Map(created.map((brand) => [brand.slug, brand.id]));
}
