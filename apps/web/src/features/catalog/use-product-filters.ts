import { PRODUCT_SORTS, type ProductSort } from '@ecommerce/shared';
import { useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router';

import type { ProductFilters } from '@/services/catalog.api';

function isSort(value: string | null): value is ProductSort {
  return value !== null && PRODUCT_SORTS.some((sort) => sort === value);
}

function positiveNumber(value: string | null): number | undefined {
  if (value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** Product filters stored in the URL so results are shareable and survive a refresh. */
export function useProductFilters() {
  const [params, setParams] = useSearchParams();
  const { slug } = useParams();

  const filters = useMemo<ProductFilters>(() => {
    const sort = params.get('sort');
    return {
      search: params.get('q') ?? undefined,
      category: slug ?? params.get('category') ?? undefined,
      brand: params
        .getAll('brand')
        .flatMap((value) => value.split(','))
        .filter(Boolean),
      minPrice: positiveNumber(params.get('minPrice')),
      maxPrice: positiveNumber(params.get('maxPrice')),
      inStock: params.get('inStock') === 'true',
      attr: params.getAll('attr'),
      sort: isSort(sort) ? sort : 'newest',
      page: Math.max(positiveNumber(params.get('page')) ?? 1, 1),
      limit: 12,
    };
  }, [params, slug]);

  /** Applies changes and resets to the first page unless the page itself changes. */
  const update = useCallback(
    (change: (next: URLSearchParams) => void) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          const pageBefore = next.get('page');
          change(next);
          if (next.get('page') === pageBefore) {
            next.delete('page');
          }
          return next;
        },
        { preventScrollReset: true },
      );
    },
    [setParams],
  );

  const actions = useMemo(
    () => ({
      setSort: (sort: ProductSort) => {
        update((next) => {
          next.set('sort', sort);
        });
      },
      toggleBrand: (brand: string) => {
        update((next) => {
          const brands = new Set(next.getAll('brand').flatMap((value) => value.split(',')));
          if (brands.has(brand)) {
            brands.delete(brand);
          } else {
            brands.add(brand);
          }
          next.delete('brand');
          for (const value of brands) {
            if (value !== '') {
              next.append('brand', value);
            }
          }
        });
      },
      toggleAttribute: (name: string, value: string) => {
        update((next) => {
          const key = `${name}:${value}`;
          const values = next.getAll('attr');
          next.delete('attr');
          for (const entry of values.includes(key)
            ? values.filter((item) => item !== key)
            : [...values, key]) {
            next.append('attr', entry);
          }
        });
      },
      setPrice: (min: number | undefined, max: number | undefined) => {
        update((next) => {
          if (min === undefined) next.delete('minPrice');
          else next.set('minPrice', String(min));
          if (max === undefined) next.delete('maxPrice');
          else next.set('maxPrice', String(max));
        });
      },
      setInStock: (inStock: boolean) => {
        update((next) => {
          if (inStock) next.set('inStock', 'true');
          else next.delete('inStock');
        });
      },
      setPage: (page: number) => {
        update((next) => {
          if (page <= 1) next.delete('page');
          else next.set('page', String(page));
        });
      },
      clear: () => {
        update((next) => {
          for (const key of ['brand', 'attr', 'minPrice', 'maxPrice', 'inStock', 'page']) {
            next.delete(key);
          }
        });
      },
    }),
    [update],
  );

  const activeCount =
    (filters.brand?.length ?? 0) +
    (filters.attr?.length ?? 0) +
    (filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0) +
    (filters.inStock === true ? 1 : 0);

  return { filters, activeCount, ...actions };
}

export type ProductFiltersController = ReturnType<typeof useProductFilters>;
