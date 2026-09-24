import { CART_LIMITS, freeShippingRemaining } from '@ecommerce/shared';
import type { CartDto } from '@ecommerce/types';
import type { AddCartItemInput, MergeCartInput } from '@ecommerce/validation';

import type { AppContext } from '../../context.js';
import { conflict, notFound, unprocessable } from '../../utils/errors.js';
import { isUniqueViolation } from '../../utils/prisma.js';
import { cartLineInclude, resolveLine, toCartItemDto } from './cart.lines.js';

interface Purchasable {
  productId: string;
  variantId: string | null;
  unitPrice: number;
  stock: number;
}

function stockMessage(stock: number): string {
  return stock === 0 ? 'This item is out of stock.' : `Only ${String(stock)} left in stock.`;
}

export function createCartService(ctx: AppContext) {
  const { prisma } = ctx;

  async function cartIdFor(userId: string): Promise<string> {
    const existing = await prisma.cart.findUnique({ where: { userId }, select: { id: true } });
    if (existing !== null) {
      return existing.id;
    }

    try {
      return (await prisma.cart.create({ data: { userId }, select: { id: true } })).id;
    } catch (error) {
      // Another request created the cart first.
      if (isUniqueViolation(error)) {
        return (await prisma.cart.findUniqueOrThrow({ where: { userId }, select: { id: true } }))
          .id;
      }
      throw error;
    }
  }

  async function load(cartId: string): Promise<CartDto> {
    const rows = await prisma.cartItem.findMany({
      where: { cartId },
      include: cartLineInclude,
      orderBy: { createdAt: 'asc' },
    });
    const lines = rows.map(resolveLine);
    const subtotal = lines
      .filter((line) => line.purchasable)
      .reduce((sum, line) => sum + line.unitPrice * line.row.quantity, 0);

    return {
      id: cartId,
      items: lines.map(toCartItemDto),
      summary: {
        itemCount: lines.reduce((sum, line) => sum + line.row.quantity, 0),
        subtotal,
        freeShippingRemaining: freeShippingRemaining(subtotal),
      },
    };
  }

  /** Validates that the product (and variant, when required) can be bought right now. */
  async function purchasable(productId: string, variantId: string | null): Promise<Purchasable> {
    const product = await prisma.product.findFirst({
      where: { id: productId, status: 'ACTIVE', category: { status: 'ACTIVE' } },
      select: {
        price: true,
        stock: true,
        variants: { select: { id: true, price: true, stock: true } },
      },
    });
    if (product === null) {
      throw notFound('Product');
    }

    if (product.variants.length === 0) {
      if (variantId !== null) {
        throw unprocessable('INVALID_VARIANT', 'This product has no options to choose from.');
      }
      return { productId, variantId: null, unitPrice: product.price, stock: product.stock };
    }

    if (variantId === null) {
      throw unprocessable('VARIANT_REQUIRED', 'Please choose an option before adding to cart.');
    }
    const variant = product.variants.find((entry) => entry.id === variantId);
    if (variant === undefined) {
      throw notFound('Product option');
    }

    return { productId, variantId, unitPrice: variant.price, stock: variant.stock };
  }

  function assertQuantity(quantity: number, stock: number): void {
    if (quantity > CART_LIMITS.maxQuantityPerItem) {
      throw unprocessable(
        'QUANTITY_LIMIT',
        `You can buy at most ${String(CART_LIMITS.maxQuantityPerItem)} of an item.`,
      );
    }
    if (quantity > stock) {
      throw conflict('INSUFFICIENT_STOCK', stockMessage(stock));
    }
  }

  /** Adds to an existing line or creates one. `clamp` trims quantities instead of failing. */
  async function addLine(cartId: string, input: AddCartItemInput, clamp: boolean): Promise<void> {
    const item = await purchasable(input.productId, input.variantId);
    const existing = await prisma.cartItem.findFirst({
      where: { cartId, productId: item.productId, variantId: item.variantId },
      select: { id: true, quantity: true },
    });

    let quantity = (existing?.quantity ?? 0) + input.quantity;
    if (clamp) {
      quantity = Math.min(quantity, item.stock, CART_LIMITS.maxQuantityPerItem);
      if (quantity <= 0) {
        return;
      }
    }
    assertQuantity(quantity, item.stock);

    if (existing !== null) {
      await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity } });
      return;
    }

    const distinct = await prisma.cartItem.count({ where: { cartId } });
    if (distinct >= CART_LIMITS.maxDistinctItems) {
      if (clamp) {
        return;
      }
      throw unprocessable('CART_FULL', 'Your cart is full. Remove an item to add another.');
    }

    await prisma.cartItem.create({
      data: {
        cartId,
        productId: item.productId,
        variantId: item.variantId,
        quantity,
        price: item.unitPrice,
      },
    });
  }

  async function ownedItem(userId: string, itemId: string) {
    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cart: { userId } },
      include: cartLineInclude,
    });
    if (item === null) {
      throw notFound('Cart item');
    }

    return item;
  }

  return {
    cartIdFor,

    async get(userId: string): Promise<CartDto> {
      return load(await cartIdFor(userId));
    },

    async add(userId: string, input: AddCartItemInput): Promise<CartDto> {
      const cartId = await cartIdFor(userId);
      await addLine(cartId, input, false);
      return load(cartId);
    },

    async update(userId: string, itemId: string, quantity: number): Promise<CartDto> {
      const item = await ownedItem(userId, itemId);
      const line = resolveLine(item);
      if (!line.purchasable) {
        throw unprocessable('ITEM_UNAVAILABLE', 'This item is no longer available.');
      }
      assertQuantity(quantity, line.availableStock);

      await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
      return load(item.cartId);
    },

    async remove(userId: string, itemId: string): Promise<CartDto> {
      const item = await ownedItem(userId, itemId);
      await prisma.cartItem.delete({ where: { id: item.id } });
      return load(item.cartId);
    },

    async clear(userId: string): Promise<CartDto> {
      const cartId = await cartIdFor(userId);
      await prisma.cartItem.deleteMany({ where: { cartId } });
      return load(cartId);
    },

    /** Merges a guest cart after sign-in, skipping lines that are no longer purchasable. */
    async merge(userId: string, input: MergeCartInput): Promise<CartDto> {
      const cartId = await cartIdFor(userId);
      for (const line of input.items) {
        try {
          await addLine(cartId, line, true);
        } catch (error) {
          ctx.logger.debug({ err: error }, 'Skipped guest cart line during merge');
        }
      }

      return load(cartId);
    },
  };
}

export type CartService = ReturnType<typeof createCartService>;
