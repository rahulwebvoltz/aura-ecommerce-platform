import type { Prisma } from '@ecommerce/db';
import { CANCELLABLE_ORDER_STATUSES } from '@ecommerce/shared';
import type { AddressSnapshot, OrderDetailDto, OrderSummaryDto } from '@ecommerce/types';
import { z } from 'zod';

import { parseAttributes } from '../products/products.mapper.js';

const addressSnapshotSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  country: z.string(),
});

export function parseAddressSnapshot(value: Prisma.JsonValue): AddressSnapshot {
  return addressSnapshotSchema.parse(value);
}

export const orderSummaryInclude = {
  items: { select: { image: true, quantity: true }, orderBy: { id: 'asc' } },
} satisfies Prisma.OrderInclude;

export const orderDetailInclude = {
  items: { orderBy: { id: 'asc' } },
  events: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;

type OrderSummaryRow = Prisma.OrderGetPayload<{ include: typeof orderSummaryInclude }>;
export type OrderDetailRow = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

type OrderBase = Omit<OrderSummaryRow, 'items'> & {
  items: { image: string | null; quantity: number }[];
};

function summarize(row: OrderBase): OrderSummaryDto {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    paymentStatus: row.paymentStatus,
    fulfillmentStatus: row.fulfillmentStatus,
    paymentMethod: row.paymentMethod,
    subtotal: row.subtotal,
    discount: row.discount,
    shipping: row.shipping,
    tax: row.tax,
    total: row.total,
    currency: row.currency,
    itemCount: row.items.reduce((sum, item) => sum + item.quantity, 0),
    previewImages: row.items
      .map((item) => item.image)
      .filter((image): image is string => image !== null)
      .slice(0, 4),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toOrderSummary(row: OrderSummaryRow): OrderSummaryDto {
  return summarize(row);
}

/** `reviewedProductIds` marks items the customer has already reviewed. */
export function toOrderDetail(
  row: OrderDetailRow,
  reviewedProductIds: ReadonlySet<string> = new Set(),
): OrderDetailDto {
  return {
    ...summarize(row),
    couponCode: row.couponCode,
    shippingAddress: parseAddressSnapshot(row.shippingAddress),
    billingAddress: parseAddressSnapshot(row.billingAddress),
    items: row.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productName,
      productSlug: item.productSlug,
      sku: item.sku,
      image: item.image,
      attributes: item.attributes === null ? null : parseAttributes(item.attributes),
      price: item.price,
      quantity: item.quantity,
      total: item.total,
      reviewed: item.productId !== null && reviewedProductIds.has(item.productId),
    })),
    events: row.events.map((event) => ({
      status: event.status,
      note: event.note,
      createdAt: event.createdAt.toISOString(),
    })),
    canCancel: CANCELLABLE_ORDER_STATUSES.includes(row.status),
    updatedAt: row.updatedAt.toISOString(),
  };
}
