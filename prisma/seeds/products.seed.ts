import type { PrismaClient } from '../src/index.js';
import { catalogSnapshot, type ProductSeed } from './catalog-data.js';

export interface SeededProduct {
  id: string;
  seed: ProductSeed;
}

/** Seeds products with their images and returns them keyed by slug. */
export async function seedProducts(
  prisma: PrismaClient,
  categoryIds: ReadonlyMap<string, string>,
  brandIds: ReadonlyMap<string, string>,
): Promise<Map<string, SeededProduct>> {
  const products = new Map<string, SeededProduct>();
  const baseTime = Date.UTC(2026, 0, 1);

  for (const [index, product] of catalogSnapshot.products.entries()) {
    const categoryId = categoryIds.get(product.category);
    if (categoryId === undefined) {
      throw new Error(`Seed product ${product.slug} references an unknown category.`);
    }

    const brandId = product.brand === null ? null : (brandIds.get(product.brand) ?? null);
    const hasVariants = product.variants.length > 0;

    const created = await prisma.product.create({
      data: {
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        shortDescription: product.shortDescription,
        description: product.description,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        stock: hasVariants ? 0 : product.stock,
        categoryId,
        brandId,
        soldCount: (index * 37) % 250,
        // Spread creation dates so "newest" sorting is meaningful.
        createdAt: new Date(baseTime + index * 36 * 60 * 60 * 1000),
        images: {
          create: product.images.map((url, sortOrder) => ({
            url,
            alt: `${product.name} image ${String(sortOrder + 1)}`,
            sortOrder,
          })),
        },
      },
      select: { id: true },
    });

    products.set(product.slug, { id: created.id, seed: product });
  }

  return products;
}
