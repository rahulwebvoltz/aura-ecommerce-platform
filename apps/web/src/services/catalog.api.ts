import {
  brandSchema,
  categoryDetailSchema,
  categorySchema,
  paginatedSchema,
  productDetailSchema,
  productFacetsSchema,
  productReviewsSchema,
  productSummarySchema,
  reviewEligibilitySchema,
  reviewResponseSchema,
} from '@ecommerce/types';
import type { ProductSort } from '@ecommerce/shared';
import type { ReviewInput, UpdateReviewInput } from '@ecommerce/validation';
import { z } from 'zod';

import { api } from './api';

export interface ProductFilters {
  search?: string | undefined;
  category?: string | undefined;
  brand?: string[] | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  inStock?: boolean | undefined;
  /** `name:value` pairs, e.g. `color:Black`. */
  attr?: string[] | undefined;
  sort?: ProductSort | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

function filterQuery(filters: ProductFilters) {
  return {
    search: filters.search,
    category: filters.category,
    brand: filters.brand?.join(','),
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    inStock: filters.inStock,
    attr: filters.attr,
    sort: filters.sort,
    page: filters.page,
    limit: filters.limit,
  };
}

const productPageSchema = paginatedSchema(productSummarySchema);

export const catalogApi = {
  products: (filters: ProductFilters, signal?: AbortSignal) =>
    api.requestRaw('/products', productPageSchema, { query: filterQuery(filters), signal }),
  facets: (filters: Pick<ProductFilters, 'search' | 'category'>, signal?: AbortSignal) =>
    api.request('/products/facets', productFacetsSchema, { query: filterQuery(filters), signal }),
  product: (slug: string) =>
    api.request(`/products/${encodeURIComponent(slug)}`, productDetailSchema),
  related: (slug: string) =>
    api.request(`/products/${encodeURIComponent(slug)}/related`, z.array(productSummarySchema)),
  categories: () => api.request('/categories', z.array(categorySchema)),
  category: (slug: string) =>
    api.request(`/categories/${encodeURIComponent(slug)}`, categoryDetailSchema),
  brands: () => api.request('/brands', z.array(brandSchema)),
};

export interface ReviewFilters {
  page?: number;
  sort?: 'newest' | 'highest' | 'lowest';
  rating?: number | undefined;
}

export const reviewsApi = {
  list: (productId: string, filters: ReviewFilters) =>
    api.requestRaw(`/products/${productId}/reviews`, productReviewsSchema, {
      query: { page: filters.page, sort: filters.sort, rating: filters.rating, limit: 5 },
    }),
  eligibility: (productId: string) =>
    api.request(`/products/${productId}/reviews/eligibility`, reviewEligibilitySchema),
  create: (productId: string, input: ReviewInput) =>
    api.request(`/products/${productId}/reviews`, reviewResponseSchema, {
      method: 'POST',
      body: input,
    }),
  update: (id: string, input: UpdateReviewInput) =>
    api.request(`/reviews/${id}`, reviewResponseSchema, { method: 'PATCH', body: input }),
  remove: (id: string) => api.send(`/reviews/${id}`, { method: 'DELETE' }),
};
