import { CANCELLABLE_ORDER_STATUSES } from '@ecommerce/shared';
import type { OrderDetailDto, OrderSummaryDto, Paginated } from '@ecommerce/types';
import type { PageQuery } from '@ecommerce/validation';

import type { AppContext } from '../../context.js';
import { conflict, notFound } from '../../utils/errors.js';
import { paginate } from '../../utils/http.js';
import { releaseCoupon } from '../coupons/coupons.service.js';
import { createPaymentsService } from '../payments/payments.service.js';
import {
  orderDetailInclude,
  orderSummaryInclude,
  toOrderDetail,
  toOrderSummary,
} from './orders.mapper.js';

export function createOrdersService(ctx: AppContext) {
  const { prisma } = ctx;
  const payments = createPaymentsService(ctx);

  async function detail(userId: string, id: string): Promise<OrderDetailDto> {
    const order = await prisma.order.findFirst({
      where: { id, userId },
      include: orderDetailInclude,
    });
    if (order === null) {
      throw notFound('Order');
    }

    const productIds = order.items
      .map((item) => item.productId)
      .filter((productId): productId is string => productId !== null);
    const reviews = await prisma.review.findMany({
      where: { userId, productId: { in: productIds } },
      select: { productId: true },
    });

    return toOrderDetail(order, new Set(reviews.map((review) => review.productId)));
  }

  return {
    async list(userId: string, query: PageQuery): Promise<Paginated<OrderSummaryDto>> {
      const where = { userId };
      const [total, rows] = await prisma.$transaction([
        prisma.order.count({ where }),
        prisma.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          include: orderSummaryInclude,
        }),
      ]);

      return paginate(rows.map(toOrderSummary), total, query.page, query.limit);
    },

    detail,

    /**
     * Cancels an order that has not started processing. Stock and coupon usage are released and
     * captured online payments are refunded.
     */
    async cancel(userId: string, id: string, reason: string | undefined): Promise<OrderDetailDto> {
      const order = await prisma.order.findFirst({
        where: { id, userId },
        include: { items: true, payments: true },
      });
      if (order === null) {
        throw notFound('Order');
      }
      if (!CANCELLABLE_ORDER_STATUSES.includes(order.status)) {
        throw conflict('ORDER_NOT_CANCELLABLE', 'This order can no longer be cancelled.');
      }

      const paid = order.payments.filter((payment) => payment.status === 'PAID');
      for (const payment of paid) {
        await payments.providerFor(payment.provider).refund(payment);
      }

      const now = ctx.now();
      await prisma.$transaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: { id, status: { in: [...CANCELLABLE_ORDER_STATUSES] } },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
            cancelReason: reason ?? null,
            ...(paid.length > 0 ? { paymentStatus: 'REFUNDED' as const } : {}),
          },
        });
        if (updated.count === 0) {
          throw conflict('ORDER_NOT_CANCELLABLE', 'This order can no longer be cancelled.');
        }

        for (const item of order.items) {
          if (item.variantId !== null) {
            await tx.productVariant.updateMany({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            });
          } else if (item.productId !== null) {
            await tx.product.updateMany({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          }
          if (item.productId !== null) {
            await tx.product.updateMany({
              where: { id: item.productId, soldCount: { gte: item.quantity } },
              data: { soldCount: { decrement: item.quantity } },
            });
          }
        }

        if (order.couponId !== null) {
          await releaseCoupon(tx, order.couponId);
        }

        await tx.payment.updateMany({
          where: { orderId: id, status: 'PAID' },
          data: { status: 'REFUNDED' },
        });
        await tx.payment.updateMany({
          where: { orderId: id, status: 'PENDING' },
          data: { status: 'FAILED', failureReason: 'Order cancelled.' },
        });
        await tx.orderEvent.create({
          data: {
            orderId: id,
            status: 'CANCELLED',
            note: reason === undefined ? 'Cancelled by customer.' : `Cancelled: ${reason}`,
          },
        });
      });

      return detail(userId, id);
    },
  };
}
