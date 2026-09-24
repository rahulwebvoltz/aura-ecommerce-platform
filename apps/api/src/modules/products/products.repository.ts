import type { DatabaseClient, Prisma } from '@ecommerce/db';
import { toMinorUnits } from '@ecommerce/shared';
import type { ProductQuery } from '@ecommerce/validation';

import { productDetailSelect, productSummarySelect } from './products.mapper.js';

type SortKey = ProductQuery['sort'];

const ORDER_BY: Record<SortKey, Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
  price_asc: [{ price: 'asc' }, { id: 'asc' }],
  price_desc: [{ price: 'desc' }, { id: 'desc' }],
  rating: [{ ratingAverage: 'desc' }, { ratingCount: 'desc' }, { id: 'desc' }],
  name_asc: [{ name: 'asc' }, { id: 'asc' }],
  popular: [{ soldCount: 'desc' }, { id: 'desc' }],
};

/** Filters that shape the result set before faceting (search and category context). */
export interface BaseFilter {
  search: string | undefined;
  categoryIds: string[] | null;
}

export function createProductsRepository(prisma: DatabaseClient) {
  const visible: Prisma.ProductWhereInput = {
    status: 'ACTIVE',
    category: { status: 'ACTIVE' },
  };

  function baseWhere({ search, categoryIds }: BaseFilter): Prisma.ProductWhereInput {
    const and: Prisma.ProductWhereInput[] = [visible];
    if (search !== undefined) {
      const contains = { contains: search, mode: 'insensitive' } as const;
      and.push({
        OR: [
          { name: contains },
          { shortDescription: contains },
          { sku: contains },
          { brand: { name: contains } },
          { category: { name: contains } },
        ],
      });
    }
    if (categoryIds !== null) {
      and.push({ categoryId: { in: categoryIds } });
    }

    return { AND: and };
  }

  function fullWhere(query: ProductQuery, base: BaseFilter): Prisma.ProductWhereInput {
    const and: Prisma.ProductWhereInput[] = [baseWhere(base)];

    if (query.brand.length > 0) {
      and.push({ brand: { slug: { in: query.brand } } });
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      and.push({
        price: {
          ...(query.minPrice === undefined ? {} : { gte: toMinorUnits(query.minPrice) }),
          ...(query.maxPrice === undefined ? {} : { lte: toMinorUnits(query.maxPrice) }),
        },
      });
    }
    if (query.inStock) {
      and.push({ OR: [{ stock: { gt: 0 } }, { variants: { some: { stock: { gt: 0 } } } }] });
    }

    const attributeFilters = Object.entries(query.attributes);
    if (attributeFilters.length > 0) {
      // Values for one attribute are OR-ed; all attributes must match the same variant.
      and.push({
        variants: {
          some: {
            AND: attributeFilters.map(([name, values]) => ({
              OR: values.map((value) => ({ attributes: { path: [name], equals: value } })),
            })),
          },
        },
      });
    }

    return { AND: and };
  }

  return {
    baseWhere,

    async list(query: ProductQuery, base: BaseFilter) {
      const where = fullWhere(query, base);
      const [total, rows] = await prisma.$transaction([
        prisma.product.count({ where }),
        prisma.product.findMany({
          where,
          orderBy: ORDER_BY[query.sort],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          select: productSummarySelect,
        }),
      ]);

      return { total, rows };
    },

    findBySlug(slug: string) {
      return prisma.product.findFirst({
        where: { AND: [visible, { slug }] },
        select: productDetailSelect,
      });
    },

    findRelated(productId: string, categoryId: string, limit: number) {
      return prisma.product.findMany({
        where: { AND: [visible, { categoryId }, { id: { not: productId } }] },
        orderBy: [{ ratingAverage: 'desc' }, { soldCount: 'desc' }],
        take: limit,
        select: productSummarySelect,
      });
    },

    async facets(base: BaseFilter) {
      const where = baseWhere(base);
      const [byCategory, byBrand, price, variants] = await prisma.$transaction([
        prisma.product.groupBy({
          by: ['categoryId'],
          where,
          orderBy: { categoryId: 'asc' },
          _count: { _all: true },
        }),
        prisma.product.groupBy({
          by: ['brandId'],
          where,
          orderBy: { brandId: 'asc' },
          _count: { _all: true },
        }),
        prisma.product.aggregate({ where, _min: { price: true }, _max: { price: true } }),
        prisma.productVariant.findMany({
          where: { product: where },
          select: { attributes: true },
        }),
      ]);

      return { byCategory, byBrand, price, variants };
    },
  };
}

export type ProductsRepository = ReturnType<typeof createProductsRepository>;
