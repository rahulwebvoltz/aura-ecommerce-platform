import type { PrismaClient } from '../src/index.js';

const DAY = 24 * 60 * 60 * 1000;

/** Seeds coupons covering active, expired, scheduled and exhausted states. */
export async function seedCoupons(prisma: PrismaClient, now = new Date()): Promise<number> {
  const result = await prisma.coupon.createMany({
    data: [
      {
        code: 'WELCOME10',
        description: '10% off your order, up to ₹500.',
        type: 'PERCENTAGE',
        value: 10,
        minimumOrderValue: 99_900,
        maximumDiscount: 50_000,
      },
      {
        code: 'FLAT200',
        description: '₹200 off orders above ₹1,499.',
        type: 'FIXED',
        value: 20_000,
        minimumOrderValue: 149_900,
      },
      {
        code: 'FESTIVE25',
        description: '25% off orders above ₹4,999, up to ₹2,500.',
        type: 'PERCENTAGE',
        value: 25,
        minimumOrderValue: 499_900,
        maximumDiscount: 250_000,
        usageLimit: 500,
        startsAt: new Date(now.getTime() - 7 * DAY),
        expiresAt: new Date(now.getTime() + 60 * DAY),
      },
      {
        code: 'SUMMER50',
        description: 'Expired summer promotion.',
        type: 'PERCENTAGE',
        value: 50,
        startsAt: new Date(now.getTime() - 120 * DAY),
        expiresAt: new Date(now.getTime() - 30 * DAY),
      },
      {
        code: 'COMINGSOON',
        description: 'Scheduled promotion that has not started yet.',
        type: 'FIXED',
        value: 50_000,
        startsAt: new Date(now.getTime() + 14 * DAY),
      },
      {
        code: 'FIRST100',
        description: 'Limited launch coupon, fully redeemed.',
        type: 'FIXED',
        value: 30_000,
        usageLimit: 100,
        usedCount: 100,
      },
      {
        code: 'RETIRED',
        description: 'Deactivated coupon.',
        type: 'FIXED',
        value: 10_000,
        status: 'INACTIVE',
      },
    ],
  });

  return result.count;
}
