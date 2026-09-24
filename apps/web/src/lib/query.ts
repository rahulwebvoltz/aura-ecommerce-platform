import { QueryClient } from '@tanstack/react-query';

import type { ProductFilters, ReviewFilters } from '@/services/catalog.api';
import { ApiError } from '@/services/api-client';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        // Client errors (4xx) will not succeed on retry.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
      },
    },
  });
}

export const queryKeys = {
  me: ['me'] as const,
  categories: ['categories'] as const,
  category: (slug: string) => ['category', slug] as const,
  brands: ['brands'] as const,
  products: (filters: ProductFilters) => ['products', filters] as const,
  facets: (filters: Pick<ProductFilters, 'search' | 'category'>) => ['facets', filters] as const,
  product: (slug: string) => ['product', slug] as const,
  related: (slug: string) => ['related', slug] as const,
  reviews: (productId: string, filters: ReviewFilters) => ['reviews', productId, filters] as const,
  reviewEligibility: (productId: string) => ['review-eligibility', productId] as const,
  cart: ['cart'] as const,
  wishlist: ['wishlist'] as const,
  addresses: ['addresses'] as const,
  orders: (page: number) => ['orders', page] as const,
  order: (id: string) => ['order', id] as const,
  paymentMethods: ['payment-methods'] as const,
};

/** A readable message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}
