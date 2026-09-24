import { seedBrands } from './seeds/brands.seed.js';
import { seedCategories } from './seeds/categories.seed.js';
import { seedCoupons } from './seeds/coupons.seed.js';
import { seedOrders } from './seeds/orders.seed.js';
import { seedProducts } from './seeds/products.seed.js';
import { seedReviews } from './seeds/reviews.seed.js';
import { seedShopping } from './seeds/shopping.seed.js';
import { DEMO_ADMIN, DEMO_CUSTOMER, seedUsers } from './seeds/users.seed.js';
import { seedVariants } from './seeds/variants.seed.js';
import { createPrismaClient, type PrismaClient } from './src/index.js';

// Truncating the root tables cascades to every dependent table.
const RESET_SQL =
  'TRUNCATE TABLE "users", "categories", "brands", "coupons", "webhook_events" RESTART IDENTITY CASCADE';

async function run(prisma: PrismaClient): Promise<void> {
  const started = performance.now();
  await prisma.$executeRawUnsafe(RESET_SQL);

  const users = await seedUsers(prisma);
  const categoryIds = await seedCategories(prisma);
  const brandIds = await seedBrands(prisma);
  const products = await seedProducts(prisma, categoryIds, brandIds);
  const variantCount = await seedVariants(prisma, products);
  const couponCount = await seedCoupons(prisma);
  const reviewCount = await seedReviews(prisma, products, users.customerIds);
  const orderCount = await seedOrders(prisma, users.demoCustomerId, products);
  await seedShopping(prisma, users.demoCustomerId, products);

  console.table({
    users: users.customerIds.length + 2,
    categories: categoryIds.size,
    brands: brandIds.size,
    products: products.size,
    variants: variantCount,
    coupons: couponCount,
    reviews: reviewCount,
    orders: orderCount,
  });
  console.log(`Seeded in ${(performance.now() - started).toFixed(0)} ms.`);
  console.log(`Demo customer: ${DEMO_CUSTOMER.email} / ${DEMO_CUSTOMER.password}`);
  console.log(`Demo admin:    ${DEMO_ADMIN.email} / ${DEMO_ADMIN.password}`);
}

const databaseUrl = process.env['DATABASE_URL'];
if (databaseUrl === undefined || databaseUrl === '') {
  throw new Error('DATABASE_URL is required to seed the database.');
}
if (process.env['NODE_ENV'] === 'production' && process.env['SEED_ALLOW_PRODUCTION'] !== 'true') {
  throw new Error('Refusing to seed a production database.');
}

const prisma = createPrismaClient({ databaseUrl });
try {
  await run(prisma);
} finally {
  await prisma.$disconnect();
}
