import type { WishlistDto } from '@ecommerce/types';

import type { AppContext } from '../../context.js';
import { notFound } from '../../utils/errors.js';
import { isUniqueViolation } from '../../utils/prisma.js';
import { productSummarySelect, toProductSummary } from '../products/products.mapper.js';

export function createWishlistService({ prisma }: AppContext) {
  async function wishlistIdFor(userId: string): Promise<string> {
    const existing = await prisma.wishlist.findUnique({ where: { userId }, select: { id: true } });
    if (existing !== null) {
      return existing.id;
    }

    try {
      return (await prisma.wishlist.create({ data: { userId }, select: { id: true } })).id;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return (
          await prisma.wishlist.findUniqueOrThrow({ where: { userId }, select: { id: true } })
        ).id;
      }
      throw error;
    }
  }

  async function load(wishlistId: string): Promise<WishlistDto> {
    const items = await prisma.wishlistItem.findMany({
      where: { wishlistId, product: { status: 'ACTIVE' } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, product: { select: productSummarySelect } },
    });

    return {
      id: wishlistId,
      items: items.map((item) => ({
        id: item.id,
        createdAt: item.createdAt.toISOString(),
        product: toProductSummary(item.product),
      })),
    };
  }

  return {
    async get(userId: string): Promise<WishlistDto> {
      return load(await wishlistIdFor(userId));
    },

    /** Idempotent: adding a product that is already saved is a no-op. */
    async add(userId: string, productId: string): Promise<WishlistDto> {
      const product = await prisma.product.findFirst({
        where: { id: productId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (product === null) {
        throw notFound('Product');
      }

      const wishlistId = await wishlistIdFor(userId);
      await prisma.wishlistItem.upsert({
        where: { wishlistId_productId: { wishlistId, productId } },
        create: { wishlistId, productId },
        update: {},
      });
      return load(wishlistId);
    },

    /** Idempotent: removing a product that is not saved is a no-op. */
    async remove(userId: string, productId: string): Promise<WishlistDto> {
      const wishlistId = await wishlistIdFor(userId);
      await prisma.wishlistItem.deleteMany({ where: { wishlistId, productId } });
      return load(wishlistId);
    },
  };
}
