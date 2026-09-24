import { faker } from '@faker-js/faker';

import type { PrismaClient } from '../src/index.js';
import type { SeededProduct } from './products.seed.js';

const REVIEW_TEMPLATES: Record<number, { title: string; comment: string }[]> = {
  5: [
    {
      title: 'Exceeded expectations',
      comment: 'Build quality is superb and it looks even better in person. Would buy again.',
    },
    {
      title: 'Absolutely love it',
      comment: 'Arrived quickly, packaged well, and works exactly as described. Five stars.',
    },
    {
      title: 'Worth every rupee',
      comment: 'I compared a lot of options before buying and this was clearly the best value.',
    },
  ],
  4: [
    {
      title: 'Great, with small nitpicks',
      comment: 'Really happy overall. Packaging could be better, but the product itself is solid.',
    },
    {
      title: 'Very good purchase',
      comment: 'Does everything I need. Took a day to get used to, now I use it daily.',
    },
  ],
  3: [
    {
      title: 'Decent for the price',
      comment: 'It does the job. Nothing exceptional, but no major complaints either.',
    },
  ],
  2: [
    {
      title: 'Not quite what I expected',
      comment: 'The finish felt cheaper than the photos suggested. Customer support was helpful.',
    },
  ],
  1: [
    {
      title: 'Disappointed',
      comment:
        'Stopped working properly after a couple of weeks. Hoping the replacement is better.',
    },
  ],
};

const RATING_WEIGHTS = [
  { rating: 5, weight: 45 },
  { rating: 4, weight: 32 },
  { rating: 3, weight: 13 },
  { rating: 2, weight: 6 },
  { rating: 1, weight: 4 },
];

/**
 * Seeds published reviews from the extra customers and recalculates product rating aggregates.
 */
export async function seedReviews(
  prisma: PrismaClient,
  products: ReadonlyMap<string, SeededProduct>,
  authorIds: readonly string[],
): Promise<number> {
  faker.seed(7);
  const now = Date.now();
  const data = [...products.values()].flatMap(({ id }) => {
    const authors = faker.helpers.arrayElements(authorIds, { min: 0, max: 6 });
    return authors.map((userId) => {
      const rating = faker.helpers.weightedArrayElement(
        RATING_WEIGHTS.map(({ rating: value, weight }) => ({ value, weight })),
      );
      const template = faker.helpers.arrayElement(REVIEW_TEMPLATES[rating] ?? []);
      const createdAt = new Date(now - faker.number.int({ min: 1, max: 180 }) * 86_400_000);
      return {
        userId,
        productId: id,
        rating,
        title: template.title,
        comment: template.comment,
        status: 'PUBLISHED' as const,
        verifiedPurchase: faker.datatype.boolean({ probability: 0.7 }),
        createdAt,
        updatedAt: createdAt,
      };
    });
  });

  const result = await prisma.review.createMany({ data });

  const aggregates = await prisma.review.groupBy({
    by: ['productId'],
    where: { status: 'PUBLISHED' },
    _avg: { rating: true },
    _count: { _all: true },
  });
  for (const aggregate of aggregates) {
    await prisma.product.update({
      where: { id: aggregate.productId },
      data: {
        ratingAverage: Math.round((aggregate._avg.rating ?? 0) * 10) / 10,
        ratingCount: aggregate._count._all,
      },
    });
  }

  return result.count;
}
