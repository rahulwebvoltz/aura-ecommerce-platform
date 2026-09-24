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

const cartSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      lineTotal: z.number(),
      priceChanged: z.boolean(),
      availableStock: z.number(),
      product: z.object({ id: z.string(), brand: z.string().nullable() }),
      variant: z.object({ attributes: z.record(z.string(), z.string()) }).nullable(),
    }),
  ),
  summary: z.object({
    itemCount: z.number(),
    subtotal: z.number(),
    freeShippingRemaining: z.number(),
  }),
});

const addressSchema = z.object({ id: z.string(), isDefault: z.boolean(), city: z.string() });

beforeEach(async () => {
  await resetDatabase(t.prisma);
  catalog = await createCatalog(t.prisma);
  const user = await createUser(t.prisma);
  session = await login(t.app, user.email, DEFAULT_PASSWORD);
});
afterAll(disconnect);

const addItem = (body: object) =>
  request(t.app).post('/api/cart/items').set(session.auth).send(body);

describe('product → cart', () => {
  it('requires authentication', async () => {
    expect((await request(t.app).get('/api/cart')).status).toBe(401);
  });

  it('adds products, merges repeated adds, and totals the cart', async () => {
    const empty = dataOf(
      (await request(t.app).get('/api/cart').set(session.auth)).body,
      cartSchema,
    );
    expect(empty.items).toEqual([]);

    await addItem({ productId: catalog.charger.id, quantity: 2 });
    const response = await addItem({ productId: catalog.charger.id });
    expect(response.status).toBe(201);

    const cart = dataOf(response.body, cartSchema);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({ quantity: 3, unitPrice: 150_000, lineTotal: 450_000 });
    expect(cart.items[0]?.product.brand).toBe('Acme');
    expect(cart.summary).toMatchObject({
      itemCount: 3,
      subtotal: 450_000,
      freeShippingRemaining: 0,
    });
  });

  it('requires a valid variant for products with options', async () => {
    expect(errorCodeOf((await addItem({ productId: catalog.phone.id })).body)).toBe(
      'VARIANT_REQUIRED',
    );
    expect(
      (await addItem({ productId: catalog.phone.id, variantId: catalog.charger.id })).status,
    ).toBe(404);
    expect(
      errorCodeOf(
        (await addItem({ productId: catalog.charger.id, variantId: catalog.blackVariant.id })).body,
      ),
    ).toBe('INVALID_VARIANT');

    const cart = dataOf(
      (await addItem({ productId: catalog.phone.id, variantId: catalog.blackVariant.id })).body,
      cartSchema,
    );
    expect(cart.items[0]?.variant?.attributes).toEqual({ color: 'Black', storage: '128GB' });
  });

  it('enforces stock and quantity limits', async () => {
    const outOfStock = await addItem({
      productId: catalog.phone.id,
      variantId: catalog.whiteVariant.id,
    });
    expect(outOfStock.status).toBe(409);
    expect(errorCodeOf(outOfStock.body)).toBe('INSUFFICIENT_STOCK');

    expect(errorCodeOf((await addItem({ productId: catalog.charger.id, quantity: 6 })).body)).toBe(
      'INSUFFICIENT_STOCK',
    );
    await addItem({ productId: catalog.cable.id, quantity: 10 });
    expect(errorCodeOf((await addItem({ productId: catalog.cable.id })).body)).toBe(
      'QUANTITY_LIMIT',
    );
    expect((await addItem({ productId: catalog.archived.id })).status).toBe(404);
  });

  it('updates, removes, and clears items', async () => {
    const added = dataOf((await addItem({ productId: catalog.charger.id })).body, cartSchema);
    const itemId = added.items[0]?.id ?? '';

    const updated = await request(t.app)
      .patch(`/api/cart/items/${itemId}`)
      .set(session.auth)
      .send({ quantity: 4 });
    expect(dataOf(updated.body, cartSchema).items[0]?.quantity).toBe(4);

    const tooMany = await request(t.app)
      .patch(`/api/cart/items/${itemId}`)
      .set(session.auth)
      .send({ quantity: 9 });
    expect(errorCodeOf(tooMany.body)).toBe('INSUFFICIENT_STOCK');

    const removed = await request(t.app).delete(`/api/cart/items/${itemId}`).set(session.auth);
    expect(dataOf(removed.body, cartSchema).items).toEqual([]);

    await addItem({ productId: catalog.cable.id });
    const cleared = await request(t.app).delete('/api/cart').set(session.auth);
    expect(dataOf(cleared.body, cartSchema).summary.itemCount).toBe(0);

    const missing = await request(t.app)
      .delete(`/api/cart/items/${catalog.cable.id}`)
      .set(session.auth);
    expect(missing.status).toBe(404);
  });

  it('flags price changes and unavailable items', async () => {
    const added = dataOf((await addItem({ productId: catalog.charger.id })).body, cartSchema);
    const itemId = added.items[0]?.id ?? '';

    await t.prisma.product.update({ where: { id: catalog.charger.id }, data: { price: 120_000 } });
    const repriced = dataOf(
      (await request(t.app).get('/api/cart').set(session.auth)).body,
      cartSchema,
    );
    expect(repriced.items[0]).toMatchObject({ unitPrice: 120_000, priceChanged: true });

    await t.prisma.product.update({
      where: { id: catalog.charger.id },
      data: { status: 'ARCHIVED' },
    });
    const unavailable = dataOf(
      (await request(t.app).get('/api/cart').set(session.auth)).body,
      cartSchema,
    );
    expect(unavailable.items[0]?.availableStock).toBe(0);
    expect(unavailable.summary.subtotal).toBe(0);

    const update = await request(t.app)
      .patch(`/api/cart/items/${itemId}`)
      .set(session.auth)
      .send({ quantity: 1 });
    expect(errorCodeOf(update.body)).toBe('ITEM_UNAVAILABLE');
  });

  it('merges a guest cart, clamping quantities and skipping invalid lines', async () => {
    const response = await request(t.app)
      .post('/api/cart/merge')
      .set(session.auth)
      .send({
        items: [
          { productId: catalog.charger.id, quantity: 9 },
          { productId: catalog.phone.id, variantId: catalog.whiteVariant.id },
          { productId: catalog.archived.id },
          { productId: catalog.phone.id },
          { productId: catalog.cable.id, quantity: 2 },
        ],
      });

    const cart = dataOf(response.body, cartSchema);
    expect(cart.items.map((item) => [item.product.id, item.quantity])).toEqual([
      [catalog.charger.id, 5],
      [catalog.cable.id, 2],
    ]);
  });

  it('shows remaining amount for free shipping', async () => {
    const cart = dataOf((await addItem({ productId: catalog.cable.id })).body, cartSchema);
    expect(cart.summary.freeShippingRemaining).toBe(99_900 - 20_000);
  });
});

describe('wishlist', () => {
  const wishlistSchema = z.object({
    items: z.array(z.object({ product: z.object({ id: z.string() }) })),
  });

  it('adds and removes products idempotently', async () => {
    const path = `/api/wishlist/${catalog.charger.id}`;
    await request(t.app).post(path).set(session.auth);
    const twice = await request(t.app).post(path).set(session.auth);
    expect(dataOf(twice.body, wishlistSchema).items).toHaveLength(1);

    const list = await request(t.app).get('/api/wishlist').set(session.auth);
    expect(dataOf(list.body, wishlistSchema).items[0]?.product.id).toBe(catalog.charger.id);

    await request(t.app).delete(path).set(session.auth);
    const removed = await request(t.app).delete(path).set(session.auth);
    expect(dataOf(removed.body, wishlistSchema).items).toEqual([]);

    expect(
      (await request(t.app).post(`/api/wishlist/${catalog.archived.id}`).set(session.auth)).status,
    ).toBe(404);
    expect((await request(t.app).post('/api/wishlist/not-a-uuid').set(session.auth)).status).toBe(
      422,
    );
  });
});

describe('addresses', () => {
  const validAddress = {
    firstName: 'Asha',
    lastName: 'Rao',
    phone: '+91 98765 43210',
    addressLine1: '12 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001',
  };

  const create = (body: object) =>
    request(t.app).post('/api/addresses').set(session.auth).send(body);

  it('makes the first address the default and keeps exactly one default', async () => {
    const first = dataOf((await create(validAddress)).body, addressSchema);
    expect(first.isDefault).toBe(true);

    const second = dataOf(
      (await create({ ...validAddress, city: 'Mumbai', isDefault: true })).body,
      addressSchema,
    );
    expect(second.isDefault).toBe(true);

    const list = dataOf(
      (await request(t.app).get('/api/addresses').set(session.auth)).body,
      z.array(addressSchema),
    );
    expect(list.filter((address) => address.isDefault).map((address) => address.city)).toEqual([
      'Mumbai',
    ]);

    const fetched = await request(t.app).get(`/api/addresses/${first.id}`).set(session.auth);
    expect(dataOf(fetched.body, addressSchema).city).toBe('Bengaluru');
  });

  it('updates only the provided fields and promotes defaults explicitly', async () => {
    const first = dataOf((await create(validAddress)).body, addressSchema);
    const second = dataOf((await create({ ...validAddress, city: 'Pune' })).body, addressSchema);

    const renamed = await request(t.app)
      .patch(`/api/addresses/${first.id}`)
      .set(session.auth)
      .send({ city: 'Mysuru', isDefault: false });
    expect(dataOf(renamed.body, addressSchema)).toMatchObject({ city: 'Mysuru', isDefault: true });

    const promoted = await request(t.app)
      .patch(`/api/addresses/${second.id}`)
      .set(session.auth)
      .send({
        isDefault: true,
        firstName: 'A',
        lastName: 'B',
        phone: '+91 91234 56789',
        addressLine1: '2 Road',
        addressLine2: 'Floor 3',
        state: 'Maharashtra',
        postalCode: '411001',
        country: 'in',
      });
    expect(dataOf(promoted.body, addressSchema).isDefault).toBe(true);
    const demoted = await request(t.app).get(`/api/addresses/${first.id}`).set(session.auth);
    expect(dataOf(demoted.body, addressSchema).isDefault).toBe(false);
  });

  it('promotes another address when the default is deleted', async () => {
    const first = dataOf((await create(validAddress)).body, addressSchema);
    const second = dataOf((await create({ ...validAddress, city: 'Pune' })).body, addressSchema);

    expect(
      (await request(t.app).delete(`/api/addresses/${first.id}`).set(session.auth)).status,
    ).toBe(204);
    const remaining = await request(t.app).get(`/api/addresses/${second.id}`).set(session.auth);
    expect(dataOf(remaining.body, addressSchema).isDefault).toBe(true);

    await request(t.app).delete(`/api/addresses/${second.id}`).set(session.auth);
    expect((await request(t.app).get(`/api/addresses/${second.id}`).set(session.auth)).status).toBe(
      404,
    );
  });

  it("hides other customers' addresses and limits the address book", async () => {
    const other = await createUser(t.prisma);
    const foreign = await createAddress(t.prisma, other.id);
    expect(
      (await request(t.app).get(`/api/addresses/${foreign.id}`).set(session.auth)).status,
    ).toBe(404);

    await t.prisma.address.createMany({
      data: Array.from({ length: 20 }, () => ({ ...validAddress, userId: session.userId })),
    });
    expect(errorCodeOf((await create(validAddress)).body)).toBe('ADDRESS_LIMIT');
    expect((await create({ city: 'x' })).status).toBe(422);
  });
});
