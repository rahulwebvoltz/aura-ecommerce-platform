import { SLUG_PATTERN } from '@ecommerce/shared';
import { describe, expect, it } from 'vitest';

import { createPrismaClient } from '../src/index.js';
import { catalogSnapshot } from './catalog-data.js';

const { brands, categories, products } = catalogSnapshot;

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => (seen.has(value) ? true : (seen.add(value), false)));
}

describe('catalog seed snapshot', () => {
  it('meets the development data volumes', () => {
    expect(products).toHaveLength(100);
    expect(brands.length).toBeGreaterThanOrEqual(20);
    expect(categories.filter((category) => category.parent === null).length).toBeGreaterThanOrEqual(
      5,
    );
  });

  it('uses unique, well-formed slugs and SKUs', () => {
    const slugs = [...categories, ...brands, ...products].map((entry) => entry.slug);
    expect(slugs.every((slug) => SLUG_PATTERN.test(slug))).toBe(true);
    expect(duplicates(categories.map((category) => category.slug))).toEqual([]);
    expect(duplicates(brands.map((brand) => brand.slug))).toEqual([]);
    expect(duplicates(products.map((product) => product.slug))).toEqual([]);

    const skus = products.flatMap((product) => [
      product.sku,
      ...product.variants.map((variant) => variant.sku),
    ]);
    expect(duplicates(skus)).toEqual([]);
  });

  it('only references known categories and brands', () => {
    const categorySlugs = new Set(categories.map((category) => category.slug));
    const brandSlugs = new Set(brands.map((brand) => brand.slug));

    for (const category of categories) {
      if (category.parent !== null) {
        expect(categorySlugs.has(category.parent)).toBe(true);
      }
    }
    for (const product of products) {
      expect(categorySlugs.has(product.category)).toBe(true);
      expect(product.brand === null || brandSlugs.has(product.brand)).toBe(true);
    }
  });

  it('stores valid integer prices, stock, and images', () => {
    for (const product of products) {
      expect(Number.isInteger(product.price) && product.price > 0).toBe(true);
      expect(product.compareAtPrice === null || product.compareAtPrice > product.price).toBe(true);
      expect(product.stock).toBeGreaterThanOrEqual(0);
      expect(product.images.length).toBeGreaterThan(0);
      for (const variant of product.variants) {
        expect(Number.isInteger(variant.price) && variant.price > 0).toBe(true);
        expect(variant.stock).toBeGreaterThanOrEqual(0);
        expect(Object.keys(variant.attributes).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('createPrismaClient', () => {
  it('builds a client without connecting', async () => {
    const client = createPrismaClient({
      databaseUrl: 'postgresql://unused@localhost:5432/unused',
      logQueries: true,
    });
    const quiet = createPrismaClient({ databaseUrl: 'postgresql://unused@localhost:5432/unused' });

    expect(typeof client.$transaction).toBe('function');
    await Promise.all([client.$disconnect(), quiet.$disconnect()]);
  });
});
