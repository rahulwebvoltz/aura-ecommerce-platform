import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { hmacSha256Hex } from '../../utils/crypto.js';
import { claimStock } from './checkout.service.js';
import {
  type Catalog,
  createAddress,
  createCatalog,
  createCoupons,
  createUser,
  DEFAULT_PASSWORD,
} from '../../test/factories.js';
import {
  createTestContext,
  dataOf,
  disconnect,
  errorCodeOf,
  login,
  RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET,
  resetDatabase,
  type Session,
} from '../../test/harness.js';

const t = createTestContext();
let catalog: Catalog;
let session: Session;
let addressId: string;

const orderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  status: z.string(),
  paymentStatus: z.string(),
  subtotal: z.number(),
  discount: z.number(),
  shipping: z.number(),
  tax: z.number(),
  total: z.number(),
  couponCode: z.string().nullable(),
  canCancel: z.boolean(),
  items: z.array(
    z.object({
      productName: z.string(),
      sku: z.string(),
      price: z.number(),
      quantity: z.number(),
      attributes: z.record(z.string(), z.string()).nullable(),
      reviewed: z.boolean(),
    }),
  ),
  events: z.array(z.object({ status: z.string() })),
  shippingAddress: z.object({ city: z.string() }),
});
const razorpayInitSchema = z.object({
  provider: z.literal('RAZORPAY'),
  providerOrderId: z.string(),
  amount: z.number(),
  prefill: z.object({ email: z.string() }),
});
const resultSchema = z.object({
  order: orderSchema,
  payment: z.union([z.object({ provider: z.literal('COD') }), razorpayInitSchema]).nullable(),
});

async function addToCart(productId: string, quantity = 1, variantId?: string): Promise<void> {
  const response = await request(t.app)
    .post('/api/cart/items')
    .set(session.auth)
    .send({ productId, quantity, variantId });
  expect(response.status).toBe(201);
}

function checkout(body: object = {}, headers: Record<string, string> = {}) {
  return request(t.app)
    .post('/api/checkout')
    .set(session.auth)
    .set(headers)
    .send({ shippingAddressId: addressId, paymentMethod: 'COD', ...body });
}

async function stockOf(productId: string): Promise<number> {
  return (await t.prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock;
}

beforeEach(async () => {
  await resetDatabase(t.prisma);
  catalog = await createCatalog(t.prisma);
  await createCoupons(t.prisma);
  const user = await createUser(t.prisma);
  addressId = (await createAddress(t.prisma, user.id)).id;
  session = await login(t.app, user.email, DEFAULT_PASSWORD);
  t.razorpay.orders.length = 0;
  t.razorpay.refunds.length = 0;
  t.mailer.messages.length = 0;
});
afterAll(disconnect);

describe('coupon validation', () => {
  it('previews discounts against the server-side cart subtotal', async () => {
    await addToCart(catalog.charger.id, 2);
    const response = await request(t.app)
      .post('/api/checkout/validate-coupon')
      .set(session.auth)
      .send({ code: 'tenoff' });

    expect(
      dataOf(
        response.body,
        z.object({ code: z.string(), discount: z.number(), description: z.string() }),
      ),
    ).toEqual({ code: 'TENOFF', discount: 30_000, description: '10% off' });

    const flat = await request(t.app)
      .post('/api/checkout/validate-coupon')
      .set(session.auth)
      .send({ code: 'FLAT100' });
    expect(dataOf(flat.body, z.object({ description: z.string() })).description).toBe(
      'Flat ₹100 off',
    );
  });

  it.each([
    ['NOPE', 404, 'NOT_FOUND'],
    ['OFF', 422, 'COUPON_INACTIVE'],
    ['SOON', 422, 'COUPON_NOT_STARTED'],
    ['OLD', 422, 'COUPON_EXPIRED'],
    ['USEDUP', 422, 'COUPON_EXHAUSTED'],
    ['BIGSPEND', 422, 'COUPON_MINIMUM_NOT_MET'],
  ])('rejects %s with %i %s', async (code, status, errorCode) => {
    await addToCart(catalog.charger.id);
    const response = await request(t.app)
      .post('/api/checkout/validate-coupon')
      .set(session.auth)
      .send({ code });

    expect(response.status).toBe(status);
    expect(errorCodeOf(response.body)).toBe(errorCode);
  });

  it('requires a non-empty cart', async () => {
    const response = await request(t.app)
      .post('/api/checkout/validate-coupon')
      .set(session.auth)
      .send({ code: 'TENOFF' });
    expect(errorCodeOf(response.body)).toBe('CART_EMPTY');
  });
});

describe('cart → checkout → order', () => {
  it('places a COD order with server-calculated totals, reserves stock, and clears the cart', async () => {
    await addToCart(catalog.charger.id, 2);
    await addToCart(catalog.phone.id, 1, catalog.blackVariant.id);

    const response = await checkout({ couponCode: 'FLAT100', total: 1, price: 1 });
    expect(response.status).toBe(201);
    const { order, payment } = dataOf(response.body, resultSchema);

    const subtotal = 2 * 150_000 + 5_000_000;
    const discounted = subtotal - 10_000;
    expect(order).toMatchObject({
      status: 'CONFIRMED',
      paymentStatus: 'PENDING',
      subtotal,
      discount: 10_000,
      shipping: 0,
      tax: Math.round(discounted * 0.18),
      total: discounted + Math.round(discounted * 0.18),
      couponCode: 'FLAT100',
      canCancel: true,
    });
    expect(order.orderNumber).toMatch(/^ORD-\d{6}-[A-Z2-9]{6}$/u);
    expect(order.events.map((event) => event.status)).toEqual(['PENDING', 'CONFIRMED']);
    expect(order.items.find((item) => item.attributes !== null)?.attributes).toEqual({
      color: 'Black',
      storage: '128GB',
    });
    expect(order.shippingAddress.city).toBe('Bengaluru');
    expect(payment).toEqual({ provider: 'COD' });

    expect(await stockOf(catalog.charger.id)).toBe(3);
    const variant = await t.prisma.productVariant.findUniqueOrThrow({
      where: { id: catalog.blackVariant.id },
    });
    expect(variant.stock).toBe(2);
    const coupon = await t.prisma.coupon.findUniqueOrThrow({ where: { code: 'FLAT100' } });
    expect(coupon.usedCount).toBe(1);

    const cart = await request(t.app).get('/api/cart').set(session.auth);
    expect(dataOf(cart.body, z.object({ items: z.array(z.unknown()) })).items).toEqual([]);
    expect(t.mailer.messages.at(-1)?.subject).toContain(order.orderNumber);
  });

  it('adds flat shipping below the free-shipping threshold', async () => {
    await addToCart(catalog.cable.id);
    const { order } = dataOf((await checkout()).body, resultSchema);
    expect(order).toMatchObject({ subtotal: 20_000, shipping: 7_900, tax: 3_600, total: 31_500 });
  });

  it('replays the same order for a repeated idempotency key', async () => {
    await addToCart(catalog.charger.id);
    const key = { 'idempotency-key': 'checkout-attempt-0001' };

    const first = await checkout({}, key);
    const second = await checkout({}, key);

    expect(second.status).toBe(200);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(dataOf(second.body, resultSchema).order.id).toBe(
      dataOf(first.body, resultSchema).order.id,
    );
    expect(await t.prisma.order.count()).toBe(1);
    expect((await checkout({}, { 'idempotency-key': 'bad key!' })).status).toBe(422);
  });

  it('rejects empty carts, stale stock, unavailable items, and foreign addresses', async () => {
    expect(errorCodeOf((await checkout()).body)).toBe('CART_EMPTY');

    await addToCart(catalog.charger.id, 5);
    await t.prisma.product.update({ where: { id: catalog.charger.id }, data: { stock: 2 } });
    const stale = await checkout();
    expect(stale.status).toBe(409);
    expect(errorCodeOf(stale.body)).toBe('CART_INVALID');

    await t.prisma.product.update({ where: { id: catalog.charger.id }, data: { stock: 0 } });
    expect(errorCodeOf((await checkout()).body)).toBe('CART_INVALID');

    await t.prisma.product.update({
      where: { id: catalog.charger.id },
      data: { stock: 10, status: 'ARCHIVED' },
    });
    expect(errorCodeOf((await checkout()).body)).toBe('CART_INVALID');

    await t.prisma.product.update({
      where: { id: catalog.charger.id },
      data: { status: 'ACTIVE' },
    });
    const other = await createUser(t.prisma);
    const foreign = await createAddress(t.prisma, other.id);
    expect((await checkout({ shippingAddressId: foreign.id })).status).toBe(404);
    expect((await checkout({ billingAddressId: foreign.id })).status).toBe(404);
    expect(await t.prisma.order.count()).toBe(0);
  });

  it('rolls back everything when a coupon is invalid at checkout', async () => {
    await addToCart(catalog.charger.id);
    expect(errorCodeOf((await checkout({ couponCode: 'OLD' })).body)).toBe('COUPON_EXPIRED');
    expect(await stockOf(catalog.charger.id)).toBe(5);

    await addToCart(catalog.cable.id);
    await checkout({ couponCode: 'ONEUSE' });
    await addToCart(catalog.cable.id);
    expect(errorCodeOf((await checkout({ couponCode: 'ONEUSE' })).body)).toBe('COUPON_EXHAUSTED');
  });

  it('uses a separate billing address when provided', async () => {
    const billing = await createAddress(t.prisma, session.userId, false);
    await t.prisma.address.update({ where: { id: billing.id }, data: { city: 'Delhi' } });
    await addToCart(catalog.cable.id);

    const response = await checkout({ billingAddressId: billing.id });
    expect(response.status).toBe(201);
    const stored = await t.prisma.order.findFirstOrThrow();
    expect(stored.billingAddress).toMatchObject({ city: 'Delhi' });
  });
});

describe('orders', () => {
  it("lists and shows the customer's own orders only", async () => {
    await addToCart(catalog.cable.id);
    const { order } = dataOf((await checkout()).body, resultSchema);

    const list = await request(t.app).get('/api/orders').set(session.auth);
    const page = z
      .object({
        data: z.array(
          z.object({ id: z.string(), itemCount: z.number(), previewImages: z.array(z.string()) }),
        ),
        meta: z.object({ total: z.number() }),
      })
      .parse(list.body);
    expect(page.meta.total).toBe(1);
    expect(page.data[0]).toMatchObject({ id: order.id, itemCount: 1, previewImages: [] });

    const detail = await request(t.app).get(`/api/orders/${order.id}`).set(session.auth);
    expect(dataOf(detail.body, orderSchema).orderNumber).toBe(order.orderNumber);

    const other = await createUser(t.prisma);
    const otherSession = await login(t.app, other.email, DEFAULT_PASSWORD);
    expect(
      (await request(t.app).get(`/api/orders/${order.id}`).set(otherSession.auth)).status,
    ).toBe(404);
  });

  it('cancels an order, restoring stock and coupon usage', async () => {
    await addToCart(catalog.charger.id, 2);
    const { order } = dataOf((await checkout({ couponCode: 'FLAT100' })).body, resultSchema);

    const cancelled = await request(t.app)
      .post(`/api/orders/${order.id}/cancel`)
      .set(session.auth)
      .send({ reason: 'Changed my mind' });
    const detail = dataOf(cancelled.body, orderSchema);
    expect(detail).toMatchObject({ status: 'CANCELLED', canCancel: false });
    expect(detail.events.at(-1)?.status).toBe('CANCELLED');

    expect(await stockOf(catalog.charger.id)).toBe(5);
    expect(
      (await t.prisma.coupon.findUniqueOrThrow({ where: { code: 'FLAT100' } })).usedCount,
    ).toBe(0);
    const payment = await t.prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(payment.status).toBe('FAILED');

    const again = await request(t.app).post(`/api/orders/${order.id}/cancel`).set(session.auth);
    expect(errorCodeOf(again.body)).toBe('ORDER_NOT_CANCELLABLE');
  });

  it('restores variant stock and refuses to cancel shipped orders', async () => {
    await addToCart(catalog.phone.id, 1, catalog.blackVariant.id);
    const { order } = dataOf((await checkout()).body, resultSchema);

    await request(t.app).post(`/api/orders/${order.id}/cancel`).set(session.auth).send({});
    const variant = await t.prisma.productVariant.findUniqueOrThrow({
      where: { id: catalog.blackVariant.id },
    });
    expect(variant.stock).toBe(3);

    await addToCart(catalog.cable.id);
    const shipped = dataOf((await checkout()).body, resultSchema).order;
    await t.prisma.order.update({ where: { id: shipped.id }, data: { status: 'SHIPPED' } });
    const refused = await request(t.app).post(`/api/orders/${shipped.id}/cancel`).set(session.auth);
    expect(refused.status).toBe(409);
    expect(
      (await request(t.app).post(`/api/orders/${catalog.cable.id}/cancel`).set(session.auth))
        .status,
    ).toBe(404);
  });
});

describe('order → payment → order status (Razorpay)', () => {
  async function razorpayOrder() {
    await addToCart(catalog.charger.id);
    const response = await checkout({ paymentMethod: 'RAZORPAY' });
    expect(response.status).toBe(201);
    const result = dataOf(response.body, resultSchema);
    const payment = razorpayInitSchema.parse(result.payment);
    return { order: result.order, payment };
  }

  function signature(orderId: string, paymentId: string): string {
    return hmacSha256Hex(RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`);
  }

  it('lists available payment methods', async () => {
    const response = await request(t.app).get('/api/payments/methods');
    expect(
      dataOf(
        response.body,
        z.object({ methods: z.array(z.object({ id: z.string(), enabled: z.boolean() })) }),
      ).methods,
    ).toEqual([
      expect.objectContaining({ id: 'COD', enabled: true }),
      expect.objectContaining({ id: 'RAZORPAY', enabled: true }),
    ]);
  });

  it('creates a pending order, verifies the signature, and confirms the order', async () => {
    const { order, payment } = await razorpayOrder();
    expect(order).toMatchObject({ status: 'PENDING', paymentStatus: 'PENDING' });
    expect(payment.amount).toBe(order.total);
    expect(t.razorpay.orders).toEqual([{ amount: order.total, receipt: order.orderNumber }]);

    const retry = await request(t.app)
      .post('/api/payments/create')
      .set(session.auth)
      .send({ orderId: order.id });
    expect(razorpayInitSchema.parse(dataOf(retry.body, z.unknown())).providerOrderId).toBe(
      payment.providerOrderId,
    );
    expect(t.razorpay.orders).toHaveLength(1);

    const verify = await request(t.app)
      .post('/api/payments/verify')
      .set(session.auth)
      .send({
        orderId: order.id,
        razorpayOrderId: payment.providerOrderId,
        razorpayPaymentId: 'pay_123',
        razorpaySignature: signature(payment.providerOrderId, 'pay_123'),
      });
    const verified = dataOf(verify.body, orderSchema);
    expect(verified).toMatchObject({ status: 'CONFIRMED', paymentStatus: 'PAID' });
    expect(verified.events.map((event) => event.status)).toEqual(['PENDING', 'CONFIRMED']);

    const paidAgain = await request(t.app)
      .post('/api/payments/create')
      .set(session.auth)
      .send({ orderId: order.id });
    expect(errorCodeOf(paidAgain.body)).toBe('PAYMENT_NOT_ALLOWED');
  });

  it('rejects forged signatures and lets the customer retry with a new payment', async () => {
    const { order, payment } = await razorpayOrder();

    const forged = await request(t.app)
      .post('/api/payments/verify')
      .set(session.auth)
      .send({
        orderId: order.id,
        razorpayOrderId: payment.providerOrderId,
        razorpayPaymentId: 'pay_123',
        razorpaySignature: 'a'.repeat(64),
      });
    expect(errorCodeOf(forged.body)).toBe('INVALID_SIGNATURE');
    const failed = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(failed.paymentStatus).toBe('FAILED');

    const retry = await request(t.app)
      .post('/api/payments/create')
      .set(session.auth)
      .send({ orderId: order.id });
    const fresh = razorpayInitSchema.parse(dataOf(retry.body, z.unknown()));
    expect(fresh.providerOrderId).not.toBe(payment.providerOrderId);
    expect(await t.prisma.payment.count({ where: { orderId: order.id } })).toBe(2);

    const wrongOrder = await request(t.app)
      .post('/api/payments/verify')
      .set(session.auth)
      .send({
        orderId: order.id,
        razorpayOrderId: 'order_unknown',
        razorpayPaymentId: 'pay_1',
        razorpaySignature: 'a'.repeat(64),
      });
    expect(wrongOrder.status).toBe(404);
  });

  it('refuses online payment for COD orders', async () => {
    await addToCart(catalog.cable.id);
    const { order } = dataOf((await checkout()).body, resultSchema);
    const response = await request(t.app)
      .post('/api/payments/create')
      .set(session.auth)
      .send({ orderId: order.id });
    expect(errorCodeOf(response.body)).toBe('PAYMENT_NOT_REQUIRED');
  });

  it('returns a null payment when Razorpay is unreachable, then recovers', async () => {
    await addToCart(catalog.charger.id);
    t.razorpay.failNext = true;
    const response = await checkout({ paymentMethod: 'RAZORPAY' });
    const result = dataOf(response.body, resultSchema);
    expect(result.payment).toBeNull();

    const retry = await request(t.app)
      .post('/api/payments/create')
      .set(session.auth)
      .send({ orderId: result.order.id });
    expect(retry.status).toBe(200);
  });

  it('refunds captured payments when a paid order is cancelled', async () => {
    const { order, payment } = await razorpayOrder();
    await request(t.app)
      .post('/api/payments/verify')
      .set(session.auth)
      .send({
        orderId: order.id,
        razorpayOrderId: payment.providerOrderId,
        razorpayPaymentId: 'pay_refund',
        razorpaySignature: signature(payment.providerOrderId, 'pay_refund'),
      });

    const cancelled = await request(t.app).post(`/api/orders/${order.id}/cancel`).set(session.auth);
    expect(dataOf(cancelled.body, orderSchema).paymentStatus).toBe('REFUNDED');
    expect(t.razorpay.refunds).toEqual([{ paymentId: 'pay_refund', amount: order.total }]);
  });

  describe('webhooks', () => {
    function sendWebhook(payload: object, eventId?: string, secret = RAZORPAY_WEBHOOK_SECRET) {
      const body = JSON.stringify(payload);
      const call = request(t.app)
        .post('/api/payments/webhook')
        .set('content-type', 'application/json')
        .set('x-razorpay-signature', hmacSha256Hex(secret, body));
      return (eventId === undefined ? call : call.set('x-razorpay-event-id', eventId)).send(body);
    }

    it('captures payments idempotently', async () => {
      const { order, payment } = await razorpayOrder();
      const event = {
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_hook', order_id: payment.providerOrderId } } },
      };

      const first = await sendWebhook(event, 'evt_1');
      expect(dataOf(first.body, z.object({ duplicate: z.boolean() })).duplicate).toBe(false);
      const second = await sendWebhook(event, 'evt_1');
      expect(dataOf(second.body, z.object({ duplicate: z.boolean() })).duplicate).toBe(true);

      const stored = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(stored).toMatchObject({ status: 'CONFIRMED', paymentStatus: 'PAID' });
      expect(
        await t.prisma.orderEvent.count({ where: { orderId: order.id, status: 'CONFIRMED' } }),
      ).toBe(1);

      // A late order.paid event for the same payment changes nothing.
      await sendWebhook({ ...event, event: 'order.paid' });
      expect(await t.prisma.orderEvent.count({ where: { orderId: order.id } })).toBe(2);
    });

    it('records failures and ignores unrelated events', async () => {
      const { order, payment } = await razorpayOrder();
      await sendWebhook(
        {
          event: 'payment.failed',
          payload: {
            payment: {
              entity: {
                id: 'pay_x',
                order_id: payment.providerOrderId,
                error_description: 'Card declined',
              },
            },
          },
        },
        'evt_fail',
      );
      const failed = await t.prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
      expect(failed).toMatchObject({ status: 'FAILED', failureReason: 'Card declined' });

      expect((await sendWebhook({ event: 'refund.created' }, 'evt_other')).status).toBe(200);
      expect(
        (
          await sendWebhook({
            event: 'payment.authorized',
            payload: { payment: { entity: { id: 'p', order_id: payment.providerOrderId } } },
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await sendWebhook({
            event: 'payment.failed',
            payload: { payment: { entity: { id: 'p', order_id: payment.providerOrderId } } },
          })
        ).status,
      ).toBe(200);
    });

    it('rejects bad signatures and malformed bodies', async () => {
      const forged = await sendWebhook({ event: 'payment.captured' }, 'evt_x', 'wrong-secret');
      expect(errorCodeOf(forged.body)).toBe('INVALID_SIGNATURE');

      const unsigned = await request(t.app)
        .post('/api/payments/webhook')
        .set('content-type', 'application/json')
        .send('{}');
      expect(unsigned.status).toBe(400);

      const text = await request(t.app)
        .post('/api/payments/webhook')
        .set('content-type', 'text/plain')
        .set('x-razorpay-signature', hmacSha256Hex(RAZORPAY_WEBHOOK_SECRET, ''))
        .send('hello');
      expect(text.status).toBe(400);

      const notJson = 'not json';
      const garbage = await request(t.app)
        .post('/api/payments/webhook')
        .set('content-type', 'application/json')
        .set('x-razorpay-signature', hmacSha256Hex(RAZORPAY_WEBHOOK_SECRET, notJson))
        .send(notJson);
      expect(errorCodeOf(garbage.body)).toBe('INVALID_JSON');
    });
  });
});

describe('when Razorpay is not configured', () => {
  const offline = createTestContext({ razorpay: null });

  it('only offers cash on delivery', async () => {
    const offlineSession = await login(
      offline.app,
      (await createUser(offline.prisma)).email,
      DEFAULT_PASSWORD,
    );
    const address = await createAddress(offline.prisma, offlineSession.userId);
    await request(offline.app)
      .post('/api/cart/items')
      .set(offlineSession.auth)
      .send({ productId: catalog.cable.id });

    const response = await request(offline.app)
      .post('/api/checkout')
      .set(offlineSession.auth)
      .send({ shippingAddressId: address.id, paymentMethod: 'RAZORPAY' });
    expect(errorCodeOf(response.body)).toBe('PAYMENT_METHOD_UNAVAILABLE');

    const cod = await request(offline.app)
      .post('/api/checkout')
      .set(offlineSession.auth)
      .send({ shippingAddressId: address.id, paymentMethod: 'COD' });
    const { order } = dataOf(cod.body, resultSchema);

    await offline.prisma.order.update({
      where: { id: order.id },
      data: { paymentMethod: 'RAZORPAY', status: 'PENDING' },
    });
    const retry = await request(offline.app)
      .post('/api/payments/create')
      .set(offlineSession.auth)
      .send({ orderId: order.id });
    expect(errorCodeOf(retry.body)).toBe('PAYMENT_METHOD_UNAVAILABLE');

    const webhook = await request(offline.app)
      .post('/api/payments/webhook')
      .set('content-type', 'application/json')
      .set('x-razorpay-signature', 'a'.repeat(64))
      .send('{}');
    expect(webhook.status).toBe(400);

    const verify = await request(offline.app)
      .post('/api/payments/verify')
      .set(offlineSession.auth)
      .send({
        orderId: order.id,
        razorpayOrderId: 'order_x',
        razorpayPaymentId: 'pay_x',
        razorpaySignature: 'a'.repeat(64),
      });
    expect(verify.status).toBe(404);
  });
});

describe('stock protection', () => {
  it('never oversells when customers check out the last unit at the same time', async () => {
    await t.prisma.product.update({ where: { id: catalog.charger.id }, data: { stock: 1 } });
    const shoppers = await Promise.all(
      Array.from({ length: 4 }, async () => {
        const user = await createUser(t.prisma);
        const address = await createAddress(t.prisma, user.id);
        const shopper = await login(t.app, user.email, DEFAULT_PASSWORD);
        await request(t.app)
          .post('/api/cart/items')
          .set(shopper.auth)
          .send({ productId: catalog.charger.id });
        return { shopper, addressId: address.id };
      }),
    );

    const responses = await Promise.all(
      shoppers.map(({ shopper, addressId: shippingAddressId }) =>
        request(t.app)
          .post('/api/checkout')
          .set(shopper.auth)
          .send({ shippingAddressId, paymentMethod: 'COD' }),
      ),
    );

    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    for (const response of responses.filter((entry) => entry.status !== 201)) {
      expect(response.status).toBe(409);
      expect(['CART_INVALID', 'INSUFFICIENT_STOCK']).toContain(errorCodeOf(response.body));
    }
    expect(await stockOf(catalog.charger.id)).toBe(0);
  });

  it('refuses to claim stock that is no longer there', async () => {
    await expect(
      t.prisma.$transaction((tx) =>
        claimStock(tx, {
          productId: catalog.phone.id,
          variantId: catalog.whiteVariant.id,
          quantity: 1,
          productName: 'Globex Phone',
        }),
      ),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK', status: 409 });
  });

  it('cancels a paid cash-on-delivery order without an online refund', async () => {
    await addToCart(catalog.cable.id);
    const { order } = dataOf((await checkout()).body, resultSchema);
    await t.prisma.payment.updateMany({ where: { orderId: order.id }, data: { status: 'PAID' } });

    const cancelled = await request(t.app).post(`/api/orders/${order.id}/cancel`).set(session.auth);
    expect(dataOf(cancelled.body, orderSchema).paymentStatus).toBe('REFUNDED');
    expect(t.razorpay.refunds).toEqual([]);
  });
});

describe('platform endpoints', () => {
  it('reports health and returns JSON 404s for unknown routes', async () => {
    const health = await request(t.app).get('/api/health');
    expect(health.body).toEqual({ data: { status: 'ok', database: 'ok' } });
    expect(health.headers['x-request-id']).toEqual(expect.any(String));

    const missing = await request(t.app).get('/api/nope').set('x-request-id', 'client-request-1');
    expect(missing.status).toBe(404);
    expect(errorCodeOf(missing.body)).toBe('ROUTE_NOT_FOUND');
    expect(missing.headers['x-request-id']).toBe('client-request-1');
  });

  it('rejects malformed and oversized JSON bodies', async () => {
    const malformed = await request(t.app)
      .post('/api/auth/login')
      .set('content-type', 'application/json')
      .send('{"email":');
    expect(errorCodeOf(malformed.body)).toBe('INVALID_JSON');

    const huge = await request(t.app)
      .post('/api/auth/login')
      .send({ email: 'a@example.com', password: 'x'.repeat(200_000) });
    expect(huge.status).toBe(413);
  });
});
