import { calculateOrderTotals, type OrderStatus } from '@ecommerce/shared';

import type { PrismaClient } from '../src/index.js';
import type { SeededProduct } from './products.seed.js';

const DAY = 86_400_000;

interface DemoOrderPlan {
  orderNumber: string;
  status: OrderStatus;
  daysAgo: number;
  productSlugs: string[];
  timeline: OrderStatus[];
}

// Delivered orders make the demo customer eligible to write verified reviews.
const PLANS: DemoOrderPlan[] = [
  {
    orderNumber: 'ORD-DEMO-1001',
    status: 'DELIVERED',
    daysAgo: 21,
    productSlugs: ['essence-mascara-lash-princess', 'apple-airpods'],
    timeline: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'],
  },
  {
    orderNumber: 'ORD-DEMO-1002',
    status: 'SHIPPED',
    daysAgo: 3,
    productSlugs: ['annibale-colombo-sofa'],
    timeline: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'],
  },
  {
    orderNumber: 'ORD-DEMO-1003',
    status: 'CANCELLED',
    daysAgo: 10,
    productSlugs: ['calvin-klein-ck-one'],
    timeline: ['PENDING', 'CONFIRMED', 'CANCELLED'],
  },
];

const EVENT_NOTES: Record<OrderStatus, string> = {
  PENDING: 'Order placed.',
  CONFIRMED: 'Order confirmed.',
  PROCESSING: 'Packed at our Bengaluru fulfilment centre.',
  SHIPPED: 'Handed over to the courier.',
  DELIVERED: 'Delivered to the customer.',
  CANCELLED: 'Cancelled at the customer’s request.',
};

/** Seeds a small order history for the demo customer. Returns the ids of delivered products. */
export async function seedOrders(
  prisma: PrismaClient,
  userId: string,
  products: ReadonlyMap<string, SeededProduct>,
): Promise<number> {
  const address = await prisma.address.findFirstOrThrow({
    where: { userId, isDefault: true },
  });
  const snapshot = {
    firstName: address.firstName,
    lastName: address.lastName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
  };
  const now = Date.now();

  for (const plan of PLANS) {
    const lines = plan.productSlugs
      .map((slug) => products.get(slug))
      .filter((product): product is SeededProduct => product !== undefined)
      .map(({ id, seed }) => ({
        productId: id,
        productName: seed.name,
        productSlug: seed.slug,
        sku: seed.sku,
        image: seed.images[0] ?? null,
        price: seed.price,
        quantity: 1,
        total: seed.price,
      }));
    if (lines.length === 0) {
      throw new Error(`Demo order ${plan.orderNumber} has no matching seed products.`);
    }

    const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
    const totals = calculateOrderTotals({ subtotal, discount: 0, itemCount: lines.length });
    const createdAt = new Date(now - plan.daysAgo * DAY);
    const delivered = plan.status === 'DELIVERED';

    await prisma.order.create({
      data: {
        orderNumber: plan.orderNumber,
        userId,
        status: plan.status,
        paymentStatus: delivered ? 'PAID' : 'PENDING',
        fulfillmentStatus: delivered ? 'FULFILLED' : 'UNFULFILLED',
        paymentMethod: 'COD',
        ...totals,
        shippingAddress: snapshot,
        billingAddress: snapshot,
        cancelledAt: plan.status === 'CANCELLED' ? new Date(createdAt.getTime() + DAY) : null,
        cancelReason: plan.status === 'CANCELLED' ? 'Ordered by mistake.' : null,
        createdAt,
        items: { create: lines },
        events: {
          create: plan.timeline.map((status, index) => ({
            status,
            note: EVENT_NOTES[status],
            createdAt: new Date(createdAt.getTime() + index * 0.8 * DAY),
          })),
        },
        payments: {
          create: {
            provider: 'COD',
            status: delivered ? 'PAID' : 'PENDING',
            amount: totals.total,
            paidAt: delivered ? new Date(createdAt.getTime() + 4 * DAY) : null,
          },
        },
      },
    });
  }

  return PLANS.length;
}
