import type { Prisma } from '@ecommerce/db';
import type {
  ProductDetailDto,
  ProductImageDto,
  ProductSummaryDto,
  ProductVariantDto,
  VariantAttributes,
  VariantOptionDto,
} from '@ecommerce/types';
import { z } from 'zod';

const attributesSchema = z.record(z.string(), z.string());

/** Reads a JSONB attribute map, tolerating malformed rows instead of failing the request. */
export function parseAttributes(value: Prisma.JsonValue | null): VariantAttributes {
  const parsed = attributesSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

const imageSelect = { id: true, url: true, alt: true, sortOrder: true } as const;

export const productSummarySelect = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  price: true,
  compareAtPrice: true,
  stock: true,
  ratingAverage: true,
  ratingCount: true,
  createdAt: true,
  images: { orderBy: { sortOrder: 'asc' }, take: 2, select: imageSelect },
  category: { select: { id: true, name: true, slug: true } },
  brand: { select: { id: true, name: true, slug: true } },
  variants: { select: { price: true, compareAtPrice: true, stock: true } },
} satisfies Prisma.ProductSelect;

export type ProductSummaryRow = Prisma.ProductGetPayload<{ select: typeof productSummarySelect }>;

export const productDetailSelect = {
  ...productSummarySelect,
  description: true,
  sku: true,
  images: { orderBy: { sortOrder: 'asc' }, select: imageSelect },
  variants: {
    orderBy: { sku: 'asc' },
    select: {
      id: true,
      sku: true,
      price: true,
      compareAtPrice: true,
      stock: true,
      attributes: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      parent: { select: { id: true, name: true, slug: true } },
    },
  },
} satisfies Prisma.ProductSelect;

export type ProductDetailRow = Prisma.ProductGetPayload<{ select: typeof productDetailSelect }>;

interface PriceSource {
  price: number;
  compareAtPrice: number | null;
  stock: number;
}

/** Cheapest variant price (products with variants) or the base price, plus total stock. */
export function effectivePricing(product: PriceSource & { variants: PriceSource[] }): PriceSource {
  if (product.variants.length === 0) {
    return { price: product.price, compareAtPrice: product.compareAtPrice, stock: product.stock };
  }

  const cheapest = product.variants.reduce((best, variant) =>
    variant.price < best.price ? variant : best,
  );
  return {
    price: cheapest.price,
    compareAtPrice: cheapest.compareAtPrice,
    stock: product.variants.reduce((sum, variant) => sum + variant.stock, 0),
  };
}

function toImage(image: ProductImageDto): ProductImageDto {
  return { id: image.id, url: image.url, alt: image.alt, sortOrder: image.sortOrder };
}

export function toProductSummary(row: ProductSummaryRow): ProductSummaryDto {
  const pricing = effectivePricing(row);
  const [image, hoverImage] = row.images;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortDescription: row.shortDescription,
    ...pricing,
    ratingAverage: row.ratingAverage,
    ratingCount: row.ratingCount,
    image: image === undefined ? null : toImage(image),
    hoverImage: hoverImage === undefined ? null : toImage(hoverImage),
    category: row.category,
    brand: row.brand,
    hasVariants: row.variants.length > 0,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Distinct option values in first-seen order, e.g. [{ name: 'color', values: ['Black'] }]. */
export function variantOptions(variants: { attributes: VariantAttributes }[]): VariantOptionDto[] {
  const options = new Map<string, Set<string>>();
  for (const { attributes } of variants) {
    for (const [name, value] of Object.entries(attributes)) {
      const values = options.get(name) ?? new Set<string>();
      values.add(value);
      options.set(name, values);
    }
  }

  return [...options].map(([name, values]) => ({ name, values: [...values] }));
}

export function toProductDetail(row: ProductDetailRow): ProductDetailDto {
  const variants: ProductVariantDto[] = row.variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    price: variant.price,
    compareAtPrice: variant.compareAtPrice,
    stock: variant.stock,
    attributes: parseAttributes(variant.attributes),
  }));
  const { parent, ...category } = row.category;
  const summary = toProductSummary({ ...row, category, images: row.images.slice(0, 2) });

  return {
    ...summary,
    description: row.description,
    sku: row.sku,
    images: row.images.map(toImage),
    variants,
    options: variantOptions(variants),
    breadcrumbs: parent === null ? [category] : [parent, category],
  };
}
