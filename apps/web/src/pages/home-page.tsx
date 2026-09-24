import { useQuery } from '@tanstack/react-query';

import { ProductGrid } from '@/features/catalog/product-card';
import { Hero } from '@/features/home/hero';
import {
  BrandMarquee,
  CategoryBento,
  ProductRail,
  PromoBanner,
  SectionHeading,
} from '@/features/home/sections';
import { useDocumentTitle } from '@/hooks/use-utils';
import { queryKeys } from '@/lib/query';
import { catalogApi, type ProductFilters } from '@/services/catalog.api';

const TOP_RATED: ProductFilters = { sort: 'rating', limit: 10, inStock: true };
const POPULAR: ProductFilters = { sort: 'popular', limit: 10 };
const NEWEST: ProductFilters = { sort: 'newest', limit: 8 };

export function HomePage() {
  useDocumentTitle(undefined);
  const topRated = useQuery({
    queryKey: queryKeys.products(TOP_RATED),
    queryFn: ({ signal }) => catalogApi.products(TOP_RATED, signal),
  });
  const popular = useQuery({
    queryKey: queryKeys.products(POPULAR),
    queryFn: ({ signal }) => catalogApi.products(POPULAR, signal),
  });
  const newest = useQuery({
    queryKey: queryKeys.products(NEWEST),
    queryFn: ({ signal }) => catalogApi.products(NEWEST, signal),
  });
  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: catalogApi.categories });
  const brands = useQuery({ queryKey: queryKeys.brands, queryFn: catalogApi.brands });

  return (
    <>
      <Hero featured={topRated.data?.data.slice(0, 3) ?? []} />
      <BrandMarquee brands={brands.data ?? []} />
      <CategoryBento categories={categories.data ?? []} loading={categories.isPending} />
      <ProductRail
        eyebrow="Trending"
        title="Most loved right now"
        products={popular.data?.data ?? []}
        loading={popular.isPending}
        action={{ to: '/products?sort=popular', label: 'See all bestsellers' }}
      />
      <PromoBanner />
      <section className="container-page py-16">
        <SectionHeading
          eyebrow="Just landed"
          title="New arrivals"
          action={{ to: '/products?sort=newest', label: 'Shop new in' }}
        />
        <ProductGrid products={newest.data?.data ?? []} loading={newest.isPending} />
      </section>
    </>
  );
}
