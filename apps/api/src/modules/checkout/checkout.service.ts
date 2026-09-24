import type { Prisma } from '@ecommerce/db';
import { calculateOrderTotals, formatMoney, PRICING } from '@ecommerce/shared';
import type { CheckoutResultDto, CouponValidationDto, PaymentInitDto } from '@ecommerce/types';
import type { CheckoutInput } from '@ecommerce/validation';

import type { AppContext } from '../../context.js';
import { generateOrderNumber } from '../../utils/crypto.js';
import { conflict, notFound, unprocessable } from '../../utils/errors.js';
import { isUniqueViolation } from '../../utils/prisma.js';
import { toAddressSnapshot } from '../addresses/addresses.service.js';
import { cartLineInclude, type ResolvedLine, resolveLine } from '../cart/cart.lines.js';
import { applyCoupon, redeemCoupon, toCouponValidation } from '../coupons/coupons.service.js';
import { orderDetailInclude, type OrderDetailRow, toOrderDetail } from '../orders/orders.mapper.js';
import { createPaymentsService } from '../payments/payments.service.js';
import { parseAttributes } from '../products/products.mapper.js';

const ORDER_NUMBER_ATTEMPTS = 3;

/**
 * Decrements stock only if enough is left. The conditional update is what prevents overselling
 * when concurrent checkouts pass validation at the same time.
 */
export async function claimStock(
  tx: Prisma.TransactionClient,
  line: { productId: string; variantId: string | null; quantity: number; productName: string },
): Promise<void> {
  const where = { stock: { gte: line.quantity } };
  const data = { stock: { decrement: line.quantity } };
  const claimed =
    line.variantId === null
      ? await tx.product.updateMany({ where: { id: line.productId, ...where }, data })
      : await tx.productVariant.updateMany({ where: { id: line.variantId, ...where }, data });
  if (claimed.count !== 1) {
    throw conflict('INSUFFICIENT_STOCK', `${line.productName} just sold out.`);
  }
}

function lineIssues(lines: ResolvedLine[]): Record<string, string[]> {
  const issues: Record<string, string[]> = {};
  for (const line of lines) {
    const { row } = line;
    if (!line.purchasable) {
      issues[row.id] = [`${row.product.name} is no longer available.`];
    } else if (row.quantity > line.availableStock) {
      issues[row.id] = [
        line.availableStock === 0
          ? `${row.product.name} is out of stock.`
          : `Only ${String(line.availableStock)} of ${row.product.name} left in stock.`,
      ];
    }
  }

  return issues;
}

export function createCheckoutService(ctx: AppContext) {
  const { prisma } = ctx;
  const payments = createPaymentsService(ctx);

  async function cartLines(db: Prisma.TransactionClient, userId: string): Promise<ResolvedLine[]> {
    const rows = await db.cartItem.findMany({
      where: { cart: { userId } },
      include: cartLineInclude,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(resolveLine);
  }

  function subtotalOf(lines: ResolvedLine[]): number {
    return lines.reduce((sum, line) => sum + line.unitPrice * line.row.quantity, 0);
  }

  async function findByIdempotencyKey(userId: string, key: string) {
    return prisma.order.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
      include: orderDetailInclude,
    });
  }

  async function paymentFor(order: OrderDetailRow): Promise<PaymentInitDto | null> {
    if (order.paymentStatus === 'PAID' || order.status === 'CANCELLED') {
      return null;
    }

    try {
      return await payments.initiateForOrder(order);
    } catch (error) {
      // The order exists; the customer can retry payment from the order page.
      ctx.logger.error({ err: error, orderId: order.id }, 'Payment initiation failed');
      return null;
    }
  }

  /** Runs the whole order creation atomically. Stock and coupon usage are claimed conditionally. */
  function placeOrder(
    userId: string,
    input: CheckoutInput,
    idempotencyKey: string | null,
    orderNumber: string,
  ): Promise<OrderDetailRow> {
    return prisma.$transaction(
      async (tx) => {
        const lines = await cartLines(tx, userId);
        if (lines.length === 0) {
          throw unprocessable('CART_EMPTY', 'Your cart is empty.');
        }
        const issues = lineIssues(lines);
        if (Object.keys(issues).length > 0) {
          throw conflict(
            'CART_INVALID',
            'Some items in your cart need attention before checkout.',
            issues,
          );
        }

        const shipping = await tx.address.findFirst({
          where: { id: input.shippingAddressId, userId },
        });
        if (shipping === null) {
          throw notFound('Shipping address');
        }
        const billing =
          input.billingAddressId === null
            ? shipping
            : await tx.address.findFirst({ where: { id: input.billingAddressId, userId } });
        if (billing === null) {
          throw notFound('Billing address');
        }

        if (!payments.providerFor(input.paymentMethod).isEnabled()) {
          throw unprocessable(
            'PAYMENT_METHOD_UNAVAILABLE',
            'This payment method is not available right now.',
          );
        }

        const subtotal = subtotalOf(lines);
        const applied =
          input.couponCode === null
            ? null
            : await applyCoupon(tx, input.couponCode, subtotal, ctx.now());
        if (applied !== null && !(await redeemCoupon(tx, applied.coupon.id))) {
          throw unprocessable('COUPON_EXHAUSTED', 'This coupon has reached its usage limit.');
        }

        const totals = calculateOrderTotals({
          subtotal,
          discount: applied?.discount ?? 0,
          itemCount: lines.length,
        });

        for (const line of lines) {
          const { row } = line;
          await claimStock(tx, {
            productId: row.productId,
            variantId: row.variantId,
            quantity: row.quantity,
            productName: row.product.name,
          });
          await tx.product.update({
            where: { id: row.productId },
            data: { soldCount: { increment: row.quantity } },
          });
        }

        const isCod = input.paymentMethod === 'COD';
        const order = await tx.order.create({
          data: {
            orderNumber,
            userId,
            status: isCod ? 'CONFIRMED' : 'PENDING',
            paymentMethod: input.paymentMethod,
            ...totals,
            currency: PRICING.currency,
            couponId: applied?.coupon.id ?? null,
            couponCode: applied?.coupon.code ?? null,
            shippingAddress: toAddressSnapshot(shipping),
            billingAddress: toAddressSnapshot(billing),
            idempotencyKey,
            items: {
              create: lines.map((line) => ({
                productId: line.row.productId,
                variantId: line.row.variantId,
                productName: line.row.product.name,
                productSlug: line.row.product.slug,
                sku: line.sku,
                image: line.row.product.images[0]?.url ?? null,
                ...(line.row.variant === null
                  ? {}
                  : { attributes: parseAttributes(line.row.variant.attributes) }),
                price: line.unitPrice,
                quantity: line.row.quantity,
                total: line.unitPrice * line.row.quantity,
              })),
            },
            events: {
              create: [
                { status: 'PENDING', note: 'Order placed.' },
                ...(isCod
                  ? [{ status: 'CONFIRMED' as const, note: 'Confirmed for cash on delivery.' }]
                  : []),
              ],
            },
            payments: {
              create: {
                provider: input.paymentMethod,
                amount: totals.total,
                currency: PRICING.currency,
              },
            },
          },
          include: orderDetailInclude,
        });

        await tx.cartItem.deleteMany({ where: { cart: { userId } } });
        return order;
      },
      { isolationLevel: 'ReadCommitted', timeout: 15_000 },
    );
  }

  async function sendConfirmation(userId: string, order: OrderDetailRow): Promise<void> {
    try {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      await ctx.mailer.send({
        to: user.email,
        subject: `Order ${order.orderNumber} received`,
        text: `Hi ${user.firstName},\n\nThanks for your order ${order.orderNumber} totalling ${formatMoney(order.total)}.\n\nTrack it at ${ctx.env.APP_URL}/account/orders/${order.id}`,
      });
    } catch (error) {
      ctx.logger.error({ err: error, orderId: order.id }, 'Order confirmation email failed');
    }
  }

  return {
    /** Previews a coupon against the server-side cart subtotal. */
    async validateCoupon(userId: string, code: string): Promise<CouponValidationDto> {
      const lines = (await cartLines(prisma, userId)).filter((line) => line.purchasable);
      if (lines.length === 0) {
        throw unprocessable('CART_EMPTY', 'Your cart is empty.');
      }

      return toCouponValidation(await applyCoupon(prisma, code, subtotalOf(lines), ctx.now()));
    },

    async checkout(
      userId: string,
      input: CheckoutInput,
      idempotencyKey: string | null,
    ): Promise<{ result: CheckoutResultDto; replayed: boolean }> {
      if (idempotencyKey !== null) {
        const previous = await findByIdempotencyKey(userId, idempotencyKey);
        if (previous !== null) {
          return {
            result: { order: toOrderDetail(previous), payment: await paymentFor(previous) },
            replayed: true,
          };
        }
      }

      for (let attempt = 1; ; attempt += 1) {
        try {
          const order = await placeOrder(
            userId,
            input,
            idempotencyKey,
            generateOrderNumber(ctx.now()),
          );
          await sendConfirmation(userId, order);
          return {
            result: { order: toOrderDetail(order), payment: await paymentFor(order) },
            replayed: false,
          };
        } catch (error) {
          if (isUniqueViolation(error)) {
            // Either a concurrent retry with the same idempotency key won, or an order number
            // collided. Replay the winner, or try again with a new number.
            const winner =
              idempotencyKey === null ? null : await findByIdempotencyKey(userId, idempotencyKey);
            if (winner !== null) {
              return {
                result: { order: toOrderDetail(winner), payment: await paymentFor(winner) },
                replayed: true,
              };
            }
            if (attempt < ORDER_NUMBER_ATTEMPTS) {
              continue;
            }
          }
          throw error;
        }
      }
    },
  };
}
