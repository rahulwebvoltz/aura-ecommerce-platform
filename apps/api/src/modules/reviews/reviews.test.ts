import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  type Catalog,
  createAddress,
  createCatalog,
  createUser,
  DEFAULT_PASSWORD,
} from '../../test/factories.js';
import {
  createTestContext,
  dataOf,
  disconnect,
  errorCodeOf,
  login,
  resetDatabase,
  type Session,
} from '../../test/harness.js';

const t = createTestContext();
let catalog: Catalog;
let session: Session;

const reviewSchema = z.object({
  id: z.string(),
  rating: z.number(),
  title: z.string(),
  verifiedPurchase: z.boolean(),
  author: z.object({ name: z.string() }),
});
const listSchema = z.object({
  data: z.array(reviewSchema),
  meta: z.object({ total: z.number() }),
  summary: z.object({
    average: z.number(),
    count: z.number(),
    distribution: z.array(z.number()),
  }),
});
const eligibilitySchema = z.object({
  canReview: z.boolean(),
  reason: z.string().nullable(),
  orderId: z.string().nullable(),
});

const review = { rating: 5, title: 'Brilliant', comment: 'Works perfectly.' };
const reviewsPath = () => `/api/products/${catalog.charger.id}/reviews`;

/** Places a COD order for the charger and marks it delivered. */
async function deliverCharger(): Promise<string> {
  const address = await createAddress(t.prisma, session.userId);
  await request(t.app)
    .post('/api/cart/items')
    .set(session.auth)
    .send({ productId: catalog.charger.id });
  const response = await request(t.app)
    .post('/api/checkout')
    .set(session.auth)
    .send({ shippingAddressId: address.id, paymentMethod: 'COD' });
  const { order } = dataOf(response.body, z.object({ order: z.object({ id: z.string() }) }));
  await t.prisma.order.update({ where: { id: order.id }, data: { status: 'DELIVERED' } });
  return order.id;
}

beforeEach(async () => {
  await resetDatabase(t.prisma);
  catalog = await createCatalog(t.prisma);
  const user = await createUser(t.prisma);
  session = await login(t.app, user.email, DEFAULT_PASSWORD);
});
afterAll(disconnect);

describe('order → review', () => {
  it('only lets customers review products delivered to them', async () => {
    const anonymous = await request(t.app).get(`${reviewsPath()}/eligibility`);
    expect(dataOf(anonymous.body, eligibilitySchema).reason).toBe('NOT_AUTHENTICATED');

    const before = await request(t.app).get(`${reviewsPath()}/eligibility`).set(session.auth);
    expect(dataOf(before.body, eligibilitySchema).reason).toBe('NOT_PURCHASED');

    const refused = await request(t.app).post(reviewsPath()).set(session.auth).send(review);
    expect(refused.status).toBe(403);
    expect(errorCodeOf(refused.body)).toBe('NOT_PURCHASED');

    const orderId = await deliverCharger();
    const eligible = await request(t.app).get(`${reviewsPath()}/eligibility`).set(session.auth);
    expect(dataOf(eligible.body, eligibilitySchema)).toEqual({
      canReview: true,
      reason: null,
      orderId,
    });

    const created = await request(t.app).post(reviewsPath()).set(session.auth).send(review);
    expect(created.status).toBe(201);
    expect(dataOf(created.body, reviewSchema)).toMatchObject({
      rating: 5,
      verifiedPurchase: true,
      author: { name: expect.stringMatching(/^Test U\.$/u) as unknown },
    });

    const product = await t.prisma.product.findUniqueOrThrow({ where: { id: catalog.charger.id } });
    expect(product).toMatchObject({ ratingAverage: 5, ratingCount: 1 });

    const duplicate = await request(t.app).post(reviewsPath()).set(session.auth).send(review);
    expect(errorCodeOf(duplicate.body)).toBe('ALREADY_REVIEWED');
    const after = await request(t.app).get(`${reviewsPath()}/eligibility`).set(session.auth);
    expect(dataOf(after.body, eligibilitySchema).reason).toBe('ALREADY_REVIEWED');

    const order = await request(t.app).get(`/api/orders/${orderId}`).set(session.auth);
    expect(
      dataOf(order.body, z.object({ items: z.array(z.object({ reviewed: z.boolean() })) })).items[0]
        ?.reviewed,
    ).toBe(true);
  });

  it('lists published reviews with a rating summary, filters, and sorting', async () => {
    const [first, second, third] = await Promise.all([
      createUser(t.prisma),
      createUser(t.prisma),
      createUser(t.prisma),
    ]);
    await t.prisma.review.createMany({
      data: [
        {
          userId: first.id,
          productId: catalog.charger.id,
          rating: 5,
          title: 'A',
          comment: 'a',
        },
        {
          userId: second.id,
          productId: catalog.charger.id,
          rating: 2,
          title: 'B',
          comment: 'b',
        },
        {
          userId: third.id,
          productId: catalog.charger.id,
          rating: 1,
          title: 'Hidden',
          comment: 'c',
          status: 'PENDING',
        },
      ],
    });

    const list = listSchema.parse((await request(t.app).get(reviewsPath())).body);
    expect(list.meta.total).toBe(2);
    expect(list.summary).toEqual({ average: 3.5, count: 2, distribution: [0, 1, 0, 0, 1] });

    const lowest = listSchema.parse(
      (await request(t.app).get(reviewsPath()).query({ sort: 'lowest' })).body,
    );
    expect(lowest.data.map((entry) => entry.rating)).toEqual([2, 5]);
    const highest = listSchema.parse(
      (await request(t.app).get(reviewsPath()).query({ sort: 'highest' })).body,
    );
    expect(highest.data.map((entry) => entry.rating)).toEqual([5, 2]);
    const fives = listSchema.parse(
      (await request(t.app).get(reviewsPath()).query({ rating: '5' })).body,
    );
    expect(fives.data.map((entry) => entry.title)).toEqual(['A']);

    const empty = listSchema.parse(
      (await request(t.app).get(`/api/products/${catalog.cable.id}/reviews`)).body,
    );
    expect(empty.summary).toEqual({ average: 0, count: 0, distribution: [0, 0, 0, 0, 0] });

    expect((await request(t.app).get(`/api/products/${catalog.archived.id}/reviews`)).status).toBe(
      404,
    );
  });

  it('lets authors edit and delete only their own reviews', async () => {
    await deliverCharger();
    const created = dataOf(
      (await request(t.app).post(reviewsPath()).set(session.auth).send(review)).body,
      reviewSchema,
    );

    const edited = await request(t.app)
      .patch(`/api/reviews/${created.id}`)
      .set(session.auth)
      .send({ rating: 3, title: 'Okay', comment: 'Changed my mind.' });
    expect(dataOf(edited.body, reviewSchema)).toMatchObject({ rating: 3, title: 'Okay' });
    expect(
      (await t.prisma.product.findUniqueOrThrow({ where: { id: catalog.charger.id } }))
        .ratingAverage,
    ).toBe(3);

    const other = await createUser(t.prisma);
    const otherSession = await login(t.app, other.email, DEFAULT_PASSWORD);
    const forbidden = await request(t.app)
      .patch(`/api/reviews/${created.id}`)
      .set(otherSession.auth)
      .send({ rating: 1 });
    expect(forbidden.status).toBe(403);
    expect(
      (await request(t.app).delete(`/api/reviews/${created.id}`).set(otherSession.auth)).status,
    ).toBe(403);

    expect(
      (await request(t.app).delete(`/api/reviews/${created.id}`).set(session.auth)).status,
    ).toBe(204);
    expect(
      (await t.prisma.product.findUniqueOrThrow({ where: { id: catalog.charger.id } })).ratingCount,
    ).toBe(0);
    expect(
      (await request(t.app).delete(`/api/reviews/${created.id}`).set(session.auth)).status,
    ).toBe(404);
  });
});
