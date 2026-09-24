import type { Prisma } from '@ecommerce/db';
import type { CartItemDto } from '@ecommerce/types';

import { parseAttributes } from '../products/products.mapper.js';

export const cartLineInclude = {
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      status: true,
      price: true,
      compareAtPrice: true,
      stock: true,
      category: { select: { status: true } },
      brand: { select: { name: true } },
      images: {
        orderBy: { sortOrder: 'asc' },
        take: 1,
        select: { id: true, url: true, alt: true, sortOrder: true },
      },
      _count: { select: { variants: true } },
    },
  },
  variant: {
    select: {
      id: true,
      sku: true,
      price: true,
      compareAtPrice: true,
      stock: true,
      attributes: true,
    },
  },
} satisfies Prisma.CartItemInclude;

export type CartLineRow = Prisma.CartItemGetPayload<{ include: typeof cartLineInclude }>;

export interface ResolvedLine {
  row: CartLineRow;
  unitPrice: number;
  compareAtPrice: number | null;
  availableStock: number;
  sku: string;
  /** False when the product was archived, its category hidden, or its variant removed. */
  purchasable: boolean;
}

/** Current catalog price, stock, and availability for a cart line. */
export function resolveLine(row: CartLineRow): ResolvedLine {
  const { product, variant } = row;
  const needsVariant = product._count.variants > 0;
  const purchasable =
    product.status === 'ACTIVE' &&
    product.category.status === 'ACTIVE' &&
    (needsVariant ? variant !== null : row.variantId === null);

  return {
    row,
    unitPrice: variant?.price ?? product.price,
    compareAtPrice: variant === null ? product.compareAtPrice : variant.compareAtPrice,
    availableStock: purchasable ? (variant?.stock ?? product.stock) : 0,
    sku: variant?.sku ?? product.sku,
    purchasable,
  };
}

export function toCartItemDto(line: ResolvedLine): CartItemDto {
  const { row } = line;
  const image = row.product.images[0];

  return {
    id: row.id,
    quantity: row.quantity,
    unitPrice: line.unitPrice,
    compareAtPrice: line.compareAtPrice,
    lineTotal: line.unitPrice * row.quantity,
    priceChanged: line.unitPrice !== row.price,
    availableStock: line.availableStock,
    product: {
      id: row.product.id,
      name: row.product.name,
      slug: row.product.slug,
      image: image ?? null,
      brand: row.product.brand?.name ?? null,
    },
    variant:
      row.variant === null
        ? null
        : {
            id: row.variant.id,
            sku: row.variant.sku,
            attributes: parseAttributes(row.variant.attributes),
          },
  };
}
