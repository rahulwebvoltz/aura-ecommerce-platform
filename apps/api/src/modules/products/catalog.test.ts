import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { type Catalog, createCatalog } from '../../test/factories.js';
import {
  createTestContext,
  dataOf,
  disconnect,
  errorCodeOf,
  resetDatabase,
} from '../../test/harness.js';

const t = createTestContext();
let catalog: Catalog;

const summarySchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  compareAtPrice: z.number().nullable(),
  stock: z.number(),
  hasVariants: z.boolean(),
  image: z.object({ url: z.string() }).nullable(),
  hoverImage: z.object({ url: z.string() }).nullable(),
  brand: z.object({ slug: z.string() }).nullable(),
});
const pageSchema = z.object({
  data: z.array(summarySchema),
  meta: z.object({ total: z.number(), totalPages: z.number(), page: z.number() }),
});

async function listNames(query: Record<string, string | string[]>): Promise<string[]> {
  const response = await request(t.app).get('/api/products').query(query);
  expect(response.status).toBe(200);
  return pageSchema.parse(response.body).data.map((product) => product.name);
}

beforeAll(async () => {
  await resetDatabase(t.prisma);
  catalog = await createCatalog(t.prisma);
});
afterAll(disconnect);

describe('categories', () => {
  it('returns the active tree with rolled-up product counts', async () => {
    const response = await request(t.app).get('/api/categories');
    const tree = dataOf(
      response.body,
      z.array(
        z.object({
          slug: z.string(),
          productCount: z.number(),
          children: z.array(z.object({ slug: z.string(), productCount: z.number() })),
        }),
      ),
    );

    expect(tree.map((category) => category.slug)).toEqual([catalog.electronics.slug]);
    expect(tree[0]?.children).toEqual([
      expect.objectContaining({ slug: catalog.phones.slug, productCount: 2 }),
    ]);
    expect(tree[0]?.productCount).toBe(3);
  });

  it('returns a category with breadcrumbs, or 404', async () => {
    const response = await request(t.app).get(`/api/categories/${catalog.phones.slug}`);
    const detail = dataOf(
      response.body,
      z.object({ breadcrumbs: z.array(z.object({ slug: z.string() })) }),
    );
    expect(detail.breadcrumbs.map((crumb) => crumb.slug)).toEqual([
      catalog.electronics.slug,
      catalog.phones.slug,
    ]);

    const root = await request(t.app).get(`/api/categories/${catalog.electronics.slug}`);
    expect(
      dataOf(root.body, z.object({ breadcrumbs: z.array(z.unknown()) })).breadcrumbs,
    ).toHaveLength(1);

    expect((await request(t.app).get(`/api/categories/${catalog.hidden.slug}`)).status).toBe(404);
    expect((await request(t.app).get('/api/categories/Bad Slug')).status).toBe(422);
  });
});

describe('brands', () => {
  it('lists brands with product counts and fetches one by slug', async () => {
    const list = dataOf(
      (await request(t.app).get('/api/brands')).body,
      z.array(z.object({ slug: z.string(), productCount: z.number() })),
    );
    expect(list).toEqual([
      expect.objectContaining({ slug: catalog.acme.slug, productCount: 1 }),
      expect.objectContaining({ slug: catalog.globex.slug, productCount: 1 }),
    ]);

    const one = await request(t.app).get(`/api/brands/${catalog.acme.slug}`);
    expect(dataOf(one.body, z.object({ name: z.string() })).name).toBe('Acme');
    expect((await request(t.app).get('/api/brands/missing')).status).toBe(404);
  });
});

describe('product listing', () => {
  it('lists only active products and summarises variant pricing and stock', async () => {
    const page = pageSchema.parse((await request(t.app).get('/api/products')).body);
    expect(page.meta.total).toBe(3);

    const phone = page.data.find((product) => product.name === 'Globex Phone');
    expect(phone).toMatchObject({
      price: 5_000_000,
      stock: 3,
      hasVariants: true,
      hoverImage: null,
    });
    const charger = page.data.find((product) => product.name === 'Acme Fast Charger');
    expect(charger).toMatchObject({ price: 150_000, compareAtPrice: 200_000, stock: 5 });
    expect(charger?.hoverImage?.url).toBe('https://example.test/charger-2.jpg');
    const cable = page.data.find((product) => product.name === 'Plain Cable');
    expect(cable).toMatchObject({ image: null, brand: null });
  });

  it('searches names, SKUs, brands, and categories case-insensitively', async () => {
    expect(await listNames({ search: 'CHARGER' })).toEqual(['Acme Fast Charger']);
    expect(await listNames({ search: 'globex' })).toEqual(['Globex Phone']);
    expect(await listNames({ search: catalog.cable.sku })).toEqual(['Plain Cable']);
    expect(await listNames({ search: 'nothing-matches' })).toEqual([]);
  });

  it('filters by category (including children), brand, price, and stock', async () => {
    expect((await listNames({ category: catalog.electronics.slug })).sort()).toEqual([
      'Acme Fast Charger',
      'Globex Phone',
      'Plain Cable',
    ]);
    expect((await listNames({ category: catalog.phones.slug })).sort()).toEqual([
      'Globex Phone',
      'Plain Cable',
    ]);
    expect(await listNames({ category: 'unknown-category' })).toEqual([]);
    expect(
      await listNames({ brand: `${catalog.acme.slug},${catalog.globex.slug}`, sort: 'name_asc' }),
    ).toEqual(['Acme Fast Charger', 'Globex Phone']);
    expect(await listNames({ minPrice: '1000', maxPrice: '2000' })).toEqual(['Acme Fast Charger']);
    expect(await listNames({ maxPrice: '300' })).toEqual(['Plain Cable']);
    expect((await listNames({ inStock: 'true' })).length).toBe(3);
  });

  it('filters variants by attribute, requiring all attributes on the same variant', async () => {
    expect(await listNames({ attr: 'color:Black' })).toEqual(['Globex Phone']);
    expect(await listNames({ attr: ['color:Black', 'color:White'] })).toEqual(['Globex Phone']);
    expect(await listNames({ attr: ['color:Black', 'storage:256GB'] })).toEqual([]);
    expect(await listNames({ attr: ['color:White', 'storage:256GB'] })).toEqual(['Globex Phone']);
  });

  it('sorts and paginates', async () => {
    expect(await listNames({ sort: 'price_asc' })).toEqual([
      'Plain Cable',
      'Acme Fast Charger',
      'Globex Phone',
    ]);
    expect(await listNames({ sort: 'price_desc' })).toEqual([
      'Globex Phone',
      'Acme Fast Charger',
      'Plain Cable',
    ]);
    expect((await listNames({ sort: 'popular' }))[0]).toBe('Globex Phone');
    expect((await listNames({ sort: 'rating' }))[0]).toBe('Globex Phone');
    expect((await listNames({ sort: 'newest' }))[0]).toBe('Plain Cable');

    const page = pageSchema.parse(
      (await request(t.app).get('/api/products').query({ limit: '2', page: '2' })).body,
    );
    expect(page.meta).toMatchObject({ total: 3, totalPages: 2, page: 2 });
    expect(page.data).toHaveLength(1);
  });

  it('rejects invalid queries', async () => {
    const response = await request(t.app)
      .get('/api/products')
      .query({ minPrice: '9', maxPrice: '1' });
    expect(response.status).toBe(422);
  });
});

describe('facets', () => {
  it('reports categories, brands, price range, and variant options', async () => {
    const response = await request(t.app).get('/api/products/facets');
    const facets = dataOf(
      response.body,
      z.object({
        categories: z.array(z.object({ slug: z.string(), count: z.number() })),
        brands: z.array(z.object({ slug: z.string(), count: z.number() })),
        priceRange: z.object({ min: z.number(), max: z.number() }),
        attributes: z.array(z.object({ name: z.string(), values: z.array(z.string()) })),
      }),
    );

    expect(facets.categories[0]).toEqual(
      expect.objectContaining({ slug: catalog.phones.slug, count: 2 }),
    );
    expect(facets.brands.map((brand) => brand.slug)).toEqual([
      catalog.acme.slug,
      catalog.globex.slug,
    ]);
    expect(facets.priceRange).toEqual({ min: 20_000, max: 5_000_000 });
    expect(facets.attributes).toEqual([
      { name: 'color', values: ['Black', 'White'] },
      { name: 'storage', values: ['128GB', '256GB'] },
    ]);
  });
});

describe('product detail', () => {
  it('returns images, variants, options, and breadcrumbs', async () => {
    const response = await request(t.app).get(`/api/products/${catalog.phone.slug}`);
    const detail = dataOf(
      response.body,
      z.object({
        variants: z.array(
          z.object({ sku: z.string(), attributes: z.record(z.string(), z.string()) }),
        ),
        options: z.array(z.object({ name: z.string(), values: z.array(z.string()) })),
        breadcrumbs: z.array(z.object({ slug: z.string() })),
        images: z.array(z.object({ url: z.string() })),
      }),
    );

    expect(detail.variants).toHaveLength(2);
    expect(detail.options).toEqual([
      { name: 'color', values: ['Black', 'White'] },
      { name: 'storage', values: ['128GB', '256GB'] },
    ]);
    expect(detail.breadcrumbs.map((crumb) => crumb.slug)).toEqual([
      catalog.electronics.slug,
      catalog.phones.slug,
    ]);

    const root = await request(t.app).get(`/api/products/${catalog.charger.slug}`);
    expect(
      dataOf(root.body, z.object({ breadcrumbs: z.array(z.unknown()) })).breadcrumbs,
    ).toHaveLength(1);
  });

  it('hides archived products and returns related products', async () => {
    const archived = await request(t.app).get(`/api/products/${catalog.archived.slug}`);
    expect(archived.status).toBe(404);
    expect(errorCodeOf(archived.body)).toBe('NOT_FOUND');

    const related = await request(t.app).get(`/api/products/${catalog.phone.slug}/related`);
    expect(dataOf(related.body, z.array(summarySchema)).map((p) => p.name)).toEqual([
      'Plain Cable',
    ]);
    expect((await request(t.app).get('/api/products/missing/related')).status).toBe(404);
  });

  it('tolerates malformed variant attributes', async () => {
    await t.prisma.productVariant.update({
      where: { id: catalog.whiteVariant.id },
      data: { attributes: { color: 1 } },
    });
    const response = await request(t.app).get(`/api/products/${catalog.phone.slug}`);
    expect(response.status).toBe(200);
    await t.prisma.productVariant.update({
      where: { id: catalog.whiteVariant.id },
      data: { attributes: { color: 'White', storage: '256GB' } },
    });
  });
});
