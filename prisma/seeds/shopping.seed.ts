import type { PrismaClient } from '../src/index.js';
import type { SeededProduct } from './products.seed.js';

const CART_SLUGS = ['apple-magsafe-battery-pack', 'nike-air-jordan-1-red-and-black'];
const WISHLIST_SLUGS = [
  'iphone-13-pro',
  'rolex-datejust',
  'gucci-bloom-eau-de',
  'knoll-saarinen-executive-conference-chair',
];

/** Seeds a starter cart and wishlist for the demo customer. */
export async function seedShopping(
  prisma: PrismaClient,
  userId: string,
  products: ReadonlyMap<string, SeededProduct>,
): Promise<void> {
  const cartLines = await Promise.all(
    CART_SLUGS.map((slug) => products.get(slug))
      .filter((product): product is SeededProduct => product !== undefined)
      .map(async ({ id, seed }) => {
        const variant = await prisma.productVariant.findFirst({
          where: { productId: id, stock: { gt: 0 } },
          orderBy: { sku: 'asc' },
        });
        return {
          productId: id,
          variantId: variant?.id ?? null,
          quantity: 1,
          price: variant?.price ?? seed.price,
        };
      }),
  );

  await prisma.cart.create({
    data: { userId, items: { create: cartLines } },
  });

  await prisma.wishlist.create({
    data: {
      userId,
      items: {
        create: WISHLIST_SLUGS.map((slug) => products.get(slug))
          .filter((product): product is SeededProduct => product !== undefined)
          .map(({ id }) => ({ productId: id })),
      },
    },
  });
}
