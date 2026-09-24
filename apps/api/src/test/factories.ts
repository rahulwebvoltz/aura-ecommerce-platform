import type { DatabaseClient } from '@ecommerce/db';
import argon2 from 'argon2';

export const DEFAULT_PASSWORD = 'Password123';

let hashed: Promise<string> | null = null;
function passwordHash(): Promise<string> {
  hashed ??= argon2.hash(DEFAULT_PASSWORD, { type: argon2.argon2id });
  return hashed;
}

let sequence = 0;
const next = () => {
  sequence += 1;
  return sequence;
};

export async function createUser(
  prisma: DatabaseClient,
  overrides: { email?: string; emailVerified?: boolean; phone?: string | null } = {},
) {
  const n = next();
  return prisma.user.create({
    data: {
      email: overrides.email ?? `user${String(n)}@example.com`,
      passwordHash: await passwordHash(),
      firstName: 'Test',
      lastName: `User${String(n)}`,
      phone: overrides.phone === undefined ? '+91 90000 00000' : overrides.phone,
      emailVerified: overrides.emailVerified ?? true,
    },
  });
}

export async function createAddress(prisma: DatabaseClient, userId: string, isDefault = true) {
  return prisma.address.create({
    data: {
      userId,
      firstName: 'Test',
      lastName: 'User',
      phone: '+91 90000 00000',
      addressLine1: '1 Test Street',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      country: 'IN',
      isDefault,
    },
  });
}

/**
 * A small catalog: Electronics > Phones, one brand, a simple product, a product with variants,
 * a product in a second brand, and an archived product.
 */
export async function createCatalog(prisma: DatabaseClient) {
  const n = next();
  const electronics = await prisma.category.create({
    data: { name: 'Electronics', slug: `electronics-${String(n)}` },
  });
  const phones = await prisma.category.create({
    data: { name: 'Phones', slug: `phones-${String(n)}`, parentId: electronics.id },
  });
  const hidden = await prisma.category.create({
    data: { name: 'Hidden', slug: `hidden-${String(n)}`, status: 'INACTIVE' },
  });
  const acme = await prisma.brand.create({ data: { name: 'Acme', slug: `acme-${String(n)}` } });
  const globex = await prisma.brand.create({
    data: { name: 'Globex', slug: `globex-${String(n)}` },
  });

  const charger = await prisma.product.create({
    data: {
      name: 'Acme Fast Charger',
      slug: `acme-fast-charger-${String(n)}`,
      sku: `CHG-${String(n)}`,
      description: 'A fast charger.',
      shortDescription: 'Charges fast.',
      price: 150_000,
      compareAtPrice: 200_000,
      stock: 5,
      categoryId: electronics.id,
      brandId: acme.id,
      soldCount: 3,
      images: {
        create: [
          { url: 'https://example.test/charger-1.jpg', sortOrder: 0 },
          { url: 'https://example.test/charger-2.jpg', sortOrder: 1 },
        ],
      },
    },
  });

  const phone = await prisma.product.create({
    data: {
      name: 'Globex Phone',
      slug: `globex-phone-${String(n)}`,
      sku: `PHN-${String(n)}`,
      description: 'A phone with options.',
      price: 5_000_000,
      stock: 0,
      categoryId: phones.id,
      brandId: globex.id,
      soldCount: 10,
      ratingAverage: 4.5,
      ratingCount: 2,
      images: { create: [{ url: 'https://example.test/phone.jpg', sortOrder: 0 }] },
      variants: {
        create: [
          {
            sku: `PHN-${String(n)}-128-BLK`,
            price: 5_000_000,
            stock: 3,
            attributes: { color: 'Black', storage: '128GB' },
          },
          {
            sku: `PHN-${String(n)}-256-WHT`,
            price: 6_000_000,
            compareAtPrice: 6_500_000,
            stock: 0,
            attributes: { color: 'White', storage: '256GB' },
          },
        ],
      },
    },
    include: { variants: { orderBy: { sku: 'asc' } } },
  });

  const cable = await prisma.product.create({
    data: {
      name: 'Plain Cable',
      slug: `plain-cable-${String(n)}`,
      sku: `CBL-${String(n)}`,
      description: 'A cable without a brand.',
      price: 20_000,
      stock: 100,
      categoryId: phones.id,
    },
  });

  const archived = await prisma.product.create({
    data: {
      name: 'Archived Gadget',
      slug: `archived-gadget-${String(n)}`,
      sku: `ARC-${String(n)}`,
      description: 'No longer sold.',
      price: 10_000,
      stock: 10,
      status: 'ARCHIVED',
      categoryId: electronics.id,
    },
  });

  const [blackVariant, whiteVariant] = phone.variants;
  if (blackVariant === undefined || whiteVariant === undefined) {
    throw new Error('Phone variants were not created.');
  }

  return {
    electronics,
    phones,
    hidden,
    acme,
    globex,
    charger,
    phone,
    blackVariant,
    whiteVariant,
    cable,
    archived,
  };
}

export type Catalog = Awaited<ReturnType<typeof createCatalog>>;

const DAY = 86_400_000;

export async function createCoupons(prisma: DatabaseClient, now = new Date()) {
  await prisma.coupon.createMany({
    data: [
      {
        code: 'TENOFF',
        type: 'PERCENTAGE',
        value: 10,
        minimumOrderValue: 100_000,
        maximumDiscount: 50_000,
      },
      { code: 'FLAT100', type: 'FIXED', value: 10_000, description: 'Flat ₹100 off' },
      { code: 'ONEUSE', type: 'FIXED', value: 5_000, usageLimit: 1 },
      { code: 'USEDUP', type: 'FIXED', value: 5_000, usageLimit: 1, usedCount: 1 },
      {
        code: 'OLD',
        type: 'FIXED',
        value: 5_000,
        startsAt: new Date(now.getTime() - 10 * DAY),
        expiresAt: new Date(now.getTime() - DAY),
      },
      { code: 'SOON', type: 'FIXED', value: 5_000, startsAt: new Date(now.getTime() + DAY) },
      { code: 'OFF', type: 'FIXED', value: 5_000, status: 'INACTIVE' },
      { code: 'BIGSPEND', type: 'FIXED', value: 5_000, minimumOrderValue: 10_000_000 },
    ],
  });
}
