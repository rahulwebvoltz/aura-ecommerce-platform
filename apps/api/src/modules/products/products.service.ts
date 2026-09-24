import type {
  Paginated,
  ProductDetailDto,
  ProductFacetsDto,
  ProductSummaryDto,
} from '@ecommerce/types';
import type { ProductQuery } from '@ecommerce/validation';

import type { AppContext } from '../../context.js';
import { notFound } from '../../utils/errors.js';
import { paginate } from '../../utils/http.js';
import { groupCount } from '../../utils/prisma.js';
import { createCategoriesService } from '../categories/categories.service.js';
import {
  parseAttributes,
  toProductDetail,
  toProductSummary,
  variantOptions,
} from './products.mapper.js';
import { type BaseFilter, createProductsRepository } from './products.repository.js';

const RELATED_LIMIT = 8;

export function createProductsService(ctx: AppContext) {
  const repo = createProductsRepository(ctx.prisma);
  const categories = createCategoriesService(ctx.prisma);

  /** Resolves the category slug; an unknown category yields an empty result, not an error. */
  async function baseFilter(query: Pick<ProductQuery, 'search' | 'category'>): Promise<BaseFilter> {
    const categoryIds =
      query.category === undefined ? null : ((await categories.idsForSlug(query.category)) ?? []);
    return { search: query.search, categoryIds };
  }

  return {
    async list(query: ProductQuery): Promise<Paginated<ProductSummaryDto>> {
      const { total, rows } = await repo.list(query, await baseFilter(query));
      return paginate(rows.map(toProductSummary), total, query.page, query.limit);
    },

    async facets(query: ProductQuery): Promise<ProductFacetsDto> {
      const base = await baseFilter(query);
      const { byCategory, byBrand, price, variants } = await repo.facets(base);

      const categoryIds = byCategory.map((entry) => entry.categoryId);
      const brandIds = byBrand
        .map((entry) => entry.brandId)
        .filter((id): id is string => id !== null);
      const [categoryRows, brandRows] = await ctx.prisma.$transaction([
        ctx.prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true, slug: true },
        }),
        ctx.prisma.brand.findMany({
          where: { id: { in: brandIds }, status: 'ACTIVE' },
          select: { id: true, name: true, slug: true },
          orderBy: { name: 'asc' },
        }),
      ]);

      const categoryCounts = new Map(byCategory.map((e) => [e.categoryId, groupCount(e._count)]));
      const brandCounts = new Map(byBrand.map((e) => [e.brandId, groupCount(e._count)]));

      return {
        categories: categoryRows
          .map((row) => ({ ...row, count: categoryCounts.get(row.id) ?? 0 }))
          .sort((a, b) => b.count - a.count),
        brands: brandRows.map((row) => ({ ...row, count: brandCounts.get(row.id) ?? 0 })),
        priceRange: { min: price._min.price ?? 0, max: price._max.price ?? 0 },
        attributes: variantOptions(
          variants.map((variant) => ({ attributes: parseAttributes(variant.attributes) })),
        ).map((option) => ({
          ...option,
          values: [...option.values].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })),
        })),
      };
    },

    async bySlug(slug: string): Promise<ProductDetailDto> {
      const row = await repo.findBySlug(slug);
      if (row === null) {
        throw notFound('Product');
      }

      return toProductDetail(row);
    },

    async related(slug: string): Promise<ProductSummaryDto[]> {
      const product = await repo.findBySlug(slug);
      if (product === null) {
        throw notFound('Product');
      }

      const rows = await repo.findRelated(product.id, product.category.id, RELATED_LIMIT);
      return rows.map(toProductSummary);
    },
  };
}
