import { PRODUCT_SORTS, type ProductSort } from '@ecommerce/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronRight, PackageSearch, SlidersHorizontal } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/display';
import { Drawer } from '@/components/ui/overlay';
import { Pagination } from '@/components/ui/pagination';
import { ActiveFilters, FilterPanel } from '@/features/catalog/filter-panel';
import { ProductCard, ProductCardSkeleton } from '@/features/catalog/product-card';
import { useProductFilters } from '@/features/catalog/use-product-filters';
import { useDocumentTitle } from '@/hooks/use-utils';
import { queryKeys } from '@/lib/query';
import { cn, pluralize } from '@/lib/utils';
import { catalogApi } from '@/services/catalog.api';

const SORT_LABELS: Record<ProductSort, string> = {
  newest: 'Newest',
  popular: 'Bestselling',
  rating: 'Top rated',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  name_asc: 'Name: A–Z',
};

export function ProductsPage() {
  const controller = useProductFilters();
  const { filters } = controller;
  const [filtersOpen, setFiltersOpen] = useState(false);

  const products = useQuery({
    queryKey: queryKeys.products(filters),
    queryFn: ({ signal }) => catalogApi.products(filters, signal),
    placeholderData: keepPreviousData,
  });
  const facetFilters = { search: filters.search, category: filters.category };
  const facets = useQuery({
    queryKey: queryKeys.facets(facetFilters),
    queryFn: ({ signal }) => catalogApi.facets(facetFilters, signal),
    placeholderData: keepPreviousData,
  });
  const category = useQuery({
    queryKey: queryKeys.category(filters.category ?? ''),
    queryFn: () => catalogApi.category(filters.category ?? ''),
    enabled: filters.category !== undefined,
  });

  const title =
    filters.search !== undefined
      ? `“${filters.search}”`
      : filters.category !== undefined
        ? (category.data?.name ?? '')
        : 'All products';
  useDocumentTitle(
    filters.search !== undefined ? `Search: ${filters.search}` : (category.data?.name ?? 'Shop'),
  );

  const total = products.data?.meta.total ?? 0;
  const filterPanel = (
    <FilterPanel facets={facets.data} loading={facets.isPending} controller={controller} />
  );

  return (
    <div className="container-page pt-8 pb-16">
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-muted">
        <Link to="/" className="-mx-1 inline-block px-1 py-2 hover:text-fg">
          Home
        </Link>
        <ChevronRight className="size-3" />
        <Link to="/products" className="-mx-1 inline-block px-1 py-2 hover:text-fg">
          Shop
        </Link>
        {category.data?.breadcrumbs.map((crumb) => (
          <span key={crumb.id} className="flex items-center gap-1.5">
            <ChevronRight className="size-3" />
            <Link
              to={`/category/${crumb.slug}`}
              className="-mx-1 inline-block px-1 py-2 hover:text-fg"
            >
              {crumb.name}
            </Link>
          </span>
        ))}
      </nav>

      <header className="mb-10 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            {filters.search !== undefined && <p className="eyebrow mb-2">Search results for</p>}
            {title === '' ? (
              <Skeleton className="h-16 w-72" />
            ) : (
              <motion.h1
                key={title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-display text-[clamp(2.8rem,6vw,5rem)]"
              >
                {title}
              </motion.h1>
            )}
            {category.data?.description != null && (
              <p className="mt-3 max-w-xl text-muted">{category.data.description}</p>
            )}
          </div>
          <p className="text-sm text-muted" aria-live="polite">
            {products.isPending ? 'Loading…' : pluralize(total, 'product')}
          </p>
        </div>

        {category.data !== undefined && category.data.children.length > 0 && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {category.data.children.map((child, index) => (
              <motion.div
                key={child.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Link
                  to={`/category/${child.slug}`}
                  className="group flex shrink-0 items-center gap-3 whitespace-nowrap rounded-full border border-border bg-surface py-1.5 pr-5 pl-1.5 text-sm font-medium transition hover:border-fg/30"
                >
                  <span className="size-9 overflow-hidden rounded-full bg-surface-2">
                    {child.image !== null && (
                      <img
                        src={child.image}
                        alt=""
                        className="size-full object-contain p-1 transition group-hover:scale-110"
                      />
                    )}
                  </span>
                  {child.name}
                  <span className="text-xs text-subtle">{child.productCount}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
            {filterPanel}
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden"
              onClick={() => {
                setFiltersOpen(true);
              }}
            >
              <SlidersHorizontal className="size-4" /> Filters
              {controller.activeCount > 0 && (
                <span className="grid size-5 place-items-center rounded-full bg-accent text-[10px] text-accent-fg">
                  {controller.activeCount}
                </span>
              )}
            </Button>
            <ActiveFilters controller={controller} facets={facets.data} />
            <label className="ml-auto flex items-center gap-2 text-sm">
              <span className="text-muted">Sort by</span>
              <select
                value={filters.sort}
                onChange={(event) => {
                  const value = PRODUCT_SORTS.find((sort) => sort === event.target.value);
                  if (value !== undefined) {
                    controller.setSort(value);
                  }
                }}
                className="h-10 rounded-full border border-border bg-surface px-4 font-medium outline-none focus:border-accent"
              >
                {PRODUCT_SORTS.map((sort) => (
                  <option key={sort} value={sort}>
                    {SORT_LABELS[sort]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {products.isPending ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
            </div>
          ) : products.data === undefined || products.data.data.length === 0 ? (
            <EmptyState
              icon={<PackageSearch className="size-7" />}
              title="Nothing matches yet"
              description="Try removing a filter or searching for something a little broader."
              action={
                controller.activeCount > 0 ? (
                  <Button variant="outline" onClick={controller.clear}>
                    Clear filters
                  </Button>
                ) : (
                  <Link to="/products">
                    <Button variant="outline">Browse everything</Button>
                  </Link>
                )
              }
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={JSON.stringify(filters)}
                initial={{ opacity: 0 }}
                animate={{ opacity: products.isPlaceholderData ? 0.5 : 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className={cn(
                  'grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3',
                  products.isPlaceholderData && 'pointer-events-none',
                )}
              >
                {products.data.data.map((product, index) => (
                  <ProductCard key={product.id} product={product} index={index} />
                ))}
              </motion.div>
            </AnimatePresence>
          )}

          <div className="pt-8">
            <Pagination
              page={products.data?.meta.page ?? 1}
              totalPages={products.data?.meta.totalPages ?? 1}
              onChange={(page) => {
                controller.setPage(page);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </div>
        </div>
      </div>

      <Drawer
        open={filtersOpen}
        onClose={() => {
          setFiltersOpen(false);
        }}
        title="Filters"
        side="left"
        footer={
          <Button
            className="w-full"
            onClick={() => {
              setFiltersOpen(false);
            }}
          >
            Show {pluralize(total, 'result')}
          </Button>
        }
      >
        {filterPanel}
      </Drawer>
    </div>
  );
}
