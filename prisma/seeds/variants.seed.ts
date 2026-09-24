import type { PrismaClient } from '../src/index.js';
import type { SeededProduct } from './products.seed.js';

/** Seeds product variants and returns the number created. */
export async function seedVariants(
  prisma: PrismaClient,
  products: ReadonlyMap<string, SeededProduct>,
): Promise<number> {
  const data = [...products.values()].flatMap(({ id, seed }) =>
    seed.variants.map((variant) => ({
      productId: id,
      sku: variant.sku,
      price: variant.price,
      compareAtPrice:
        seed.compareAtPrice === null ? null : seed.compareAtPrice + (variant.price - seed.price),
      stock: variant.stock,
      attributes: variant.attributes,
    })),
  );

  const result = await prisma.productVariant.createMany({ data });
  return result.count;
}
