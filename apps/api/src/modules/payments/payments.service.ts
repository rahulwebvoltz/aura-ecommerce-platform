import type { Order, Payment, PaymentMethod } from '@ecommerce/db';
import type { OrderDetailDto, PaymentInitDto, PaymentMethodsDto } from '@ecommerce/types';
import type { VerifyPaymentInput } from '@ecommerce/validation';
import { z } from 'zod';

import type { AppContext } from '../../context.js';
import { sha256 } from '../../utils/crypto.js';
import { badRequest, conflict, notFound, unprocessable } from '../../utils/errors.js';
import { orderDetailInclude, toOrderDetail } from '../orders/orders.mapper.js';
import { createCodProvider } from './providers/cod.provider.js';
import type { PaymentOrder, PaymentProvider } from './providers/payment-provider.js';
import { createRazorpayProvider } from './providers/razorpay.provider.js';

const webhookSchema = z.object({
  event: z.string().max(64),
  payload: z
    .object({
      payment: z
        .object({
          entity: z.object({
            id: z.string(),
            order_id: z.string().nullable().optional(),
            error_description: z.string().nullable().optional(),
          }),
        })
        .optional(),
    })
    .default({}),
});

export interface WebhookResult {
  received: true;
  duplicate: boolean;
}

export function createPaymentsService(ctx: AppContext) {
  const { prisma } = ctx;
  const providers: Record<PaymentMethod, PaymentProvider> = {
    COD: createCodProvider(),
    RAZORPAY: createRazorpayProvider(prisma, ctx.razorpay),
  };

  function providerFor(method: PaymentMethod): PaymentProvider {
    return providers[method];
  }

  async function paymentOrder(order: Order): Promise<PaymentOrder> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: order.userId } });
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      currency: order.currency,
      customer: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phone ?? '',
      },
    };
  }

  /** Marks a payment as captured and confirms its order. Safe to call more than once. */
  async function markPaid(payment: Payment, providerPaymentId: string | null): Promise<void> {
    const now = ctx.now();
    await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: payment.id, status: { in: ['PENDING', 'FAILED'] } },
        data: { status: 'PAID', providerPaymentId, paidAt: now, failureReason: null },
      });
      if (updated.count === 0) {
        return;
      }

      const order = await tx.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus: 'PAID' },
      });
      if (order.status === 'PENDING') {
        await tx.order.update({ where: { id: order.id }, data: { status: 'CONFIRMED' } });
        await tx.orderEvent.create({
          data: { orderId: order.id, status: 'CONFIRMED', note: 'Payment received.' },
        });
      } else if (order.status === 'CANCELLED') {
        ctx.logger.warn({ orderId: order.id }, 'Payment captured for a cancelled order');
      }
    });
  }

  async function markFailed(payment: Payment, reason: string | null): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'FAILED', failureReason: reason?.slice(0, 500) ?? 'Payment failed.' },
      });
      if (updated.count === 1) {
        await tx.order.updateMany({
          where: { id: payment.orderId, paymentStatus: 'PENDING' },
          data: { paymentStatus: 'FAILED' },
        });
      }
    });
  }

  async function ownedOrder(userId: string, orderId: string): Promise<Order> {
    const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
    if (order === null) {
      throw notFound('Order');
    }

    return order;
  }

  async function latestPayment(orderId: string): Promise<Payment | null> {
    return prisma.payment.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' } });
  }

  return {
    providerFor,

    methods(): PaymentMethodsDto {
      return {
        methods: Object.values(providers).map((provider) => ({
          id: provider.method,
          label: provider.label,
          enabled: provider.isEnabled(),
        })),
      };
    },

    /** Starts (or restarts) payment for an order that is still awaiting online payment. */
    async initiateForOrder(order: Order): Promise<PaymentInitDto> {
      const provider = providerFor(order.paymentMethod);
      let payment = await latestPayment(order.id);
      if (payment?.status === 'FAILED') {
        // A failed attempt cannot be reused with the provider, so start a fresh one.
        payment = await prisma.payment.create({
          data: {
            orderId: order.id,
            provider: order.paymentMethod,
            amount: order.total,
            currency: order.currency,
          },
        });
        await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PENDING' } });
      }
      if (payment === null) {
        throw notFound('Payment');
      }

      return provider.initiate(await paymentOrder(order), payment);
    },

    async create(userId: string, orderId: string): Promise<PaymentInitDto> {
      const order = await ownedOrder(userId, orderId);
      if (order.paymentMethod !== 'RAZORPAY') {
        throw unprocessable('PAYMENT_NOT_REQUIRED', 'This order does not need online payment.');
      }
      if (order.status === 'CANCELLED' || order.paymentStatus === 'PAID') {
        throw conflict('PAYMENT_NOT_ALLOWED', 'This order can no longer be paid.');
      }

      return this.initiateForOrder(order);
    },

    /** Verifies the checkout signature on the server before trusting a client-reported payment. */
    async verify(userId: string, input: VerifyPaymentInput): Promise<OrderDetailDto> {
      const order = await ownedOrder(userId, input.orderId);
      const payment = await prisma.payment.findFirst({
        where: { orderId: order.id, providerOrderId: input.razorpayOrderId },
      });
      if (payment === null) {
        throw notFound('Payment');
      }

      const valid =
        ctx.razorpay?.verifyPaymentSignature({
          orderId: input.razorpayOrderId,
          paymentId: input.razorpayPaymentId,
          signature: input.razorpaySignature,
        }) ?? false;
      if (!valid) {
        await markFailed(payment, 'Signature verification failed.');
        throw badRequest('INVALID_SIGNATURE', 'We could not verify this payment.');
      }

      await markPaid(payment, input.razorpayPaymentId);
      const updated = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderDetailInclude,
      });
      return toOrderDetail(updated);
    },

    /**
     * Handles Razorpay webhooks. Each delivery is recorded by event id so retries are
     * acknowledged without being processed twice.
     */
    async webhook(
      rawBody: Buffer,
      signature: string | undefined,
      eventId: string | undefined,
    ): Promise<WebhookResult> {
      if (
        ctx.razorpay === null ||
        signature === undefined ||
        !ctx.razorpay.verifyWebhookSignature(rawBody, signature)
      ) {
        throw badRequest('INVALID_SIGNATURE', 'Webhook signature verification failed.');
      }

      let json: unknown;
      try {
        json = JSON.parse(rawBody.toString('utf8'));
      } catch {
        throw badRequest('INVALID_JSON', 'The webhook body is not valid JSON.');
      }
      const event = webhookSchema.parse(json);
      const key = (eventId ?? sha256(rawBody.toString('utf8'))).slice(0, 128);

      const existing = await prisma.webhookEvent.findUnique({
        where: { provider_eventId: { provider: 'RAZORPAY', eventId: key } },
      });
      if (existing?.processedAt != null) {
        return { received: true, duplicate: true };
      }
      if (existing === null) {
        await prisma.webhookEvent.upsert({
          where: { provider_eventId: { provider: 'RAZORPAY', eventId: key } },
          create: {
            provider: 'RAZORPAY',
            eventId: key,
            eventType: event.event,
            payload: z.json().parse(json) ?? {},
          },
          update: {},
        });
      }

      const entity = event.payload.payment?.entity;
      const providerOrderId = entity?.order_id ?? null;
      const payment =
        providerOrderId === null
          ? null
          : await prisma.payment.findUnique({ where: { providerOrderId } });

      if (payment !== null && entity !== undefined) {
        switch (event.event) {
          case 'payment.captured':
          case 'order.paid':
            await markPaid(payment, entity.id);
            break;
          case 'payment.failed':
            await markFailed(payment, entity.error_description ?? null);
            break;
          default:
            break;
        }
      }

      await prisma.webhookEvent.update({
        where: { provider_eventId: { provider: 'RAZORPAY', eventId: key } },
        data: { processedAt: ctx.now() },
      });
      return { received: true, duplicate: false };
    },
  };
}

export type PaymentsService = ReturnType<typeof createPaymentsService>;
