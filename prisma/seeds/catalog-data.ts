import catalog from './data/catalog.json' with { type: 'json' };

export interface CategorySeed {
  slug: string;
  name: string;
  description: string;
  image: string | null;
  parent: string | null;
  sortOrder: number;
}

export interface BrandSeed {
  slug: string;
  name: string;
}

export interface VariantSeed {
  sku: string;
  price: number;
  stock: number;
  attributes: Record<string, string>;
}

export interface ProductSeed {
  name: string;
  slug: string;
  sku: string;
  shortDescription: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  category: string;
  brand: string | null;
  tags: string[];
  images: string[];
  variants: VariantSeed[];
}

export interface CatalogSnapshot {
  categories: CategorySeed[];
  brands: BrandSeed[];
  products: ProductSeed[];
}

/**
 * Demo catalog derived from the DummyJSON sample dataset (https://dummyjson.com). Prices were
 * converted to INR paise and variants were generated deterministically.
 */
export const catalogSnapshot: CatalogSnapshot = catalog;
