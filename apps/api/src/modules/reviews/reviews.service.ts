import type { Prisma } from '@ecommerce/db';
import type {
  ProductReviewsDto,
  ReviewDto,
  ReviewEligibilityDto,
  ReviewSummaryDto,
} from '@ecommerce/types';
import type { ReviewInput, ReviewQuery, UpdateReviewInput } from '@ecommerce/validation';

import type { AppContext } from '../../context.js';
import { conflict, forbidden, notFound } from '../../utils/errors.js';
import { paginate } from '../../utils/http.js';
import { groupCount, isUniqueViolation } from '../../utils/prisma.js';

const reviewInclude = {
  user: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.ReviewInclude;

type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

const ORDER_BY: Record<ReviewQuery['sort'], Prisma.ReviewOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
  highest: [{ rating: 'desc' }, { createdAt: 'desc' }],
  lowest: [{ rating: 'asc' }, { createdAt: 'desc' }],
};

function toReview(row: ReviewRow): ReviewDto {
  return {
    id: row.id,
    rating: row.rating,
    title: row.title,
    comment: row.comment,
    status: row.status,
    verifiedPurchase: row.verifiedPurchase,
    // Only the first name and last initial are shown publicly.
    author: { id: row.user.id, name: `${row.user.firstName} ${row.user.lastName.charAt(0)}.` },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createReviewsService(ctx: AppContext) {
  const { prisma } = ctx;

  /** Recalculates the denormalised rating on the product from published reviews. */
  async function refreshRating(tx: Prisma.TransactionClient, productId: string): Promise<void> {
    const aggregate = await tx.review.aggregate({
      where: { productId, status: 'PUBLISHED' },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await tx.product.update({
      where: { id: productId },
      data: {
        ratingAverage: Math.round((aggregate._avg.rating ?? 0) * 10) / 10,
        ratingCount: aggregate._count._all,
      },
    });
  }

  async function requireProduct(productId: string): Promise<void> {
    const product = await prisma.product.findFirst({
      where: { id: productId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (product === null) {
      throw notFound('Product');
    }
  }

  /** A delivered order containing the product makes the customer a verified purchaser. */
  async function deliveredOrderId(userId: string, productId: string): Promise<string | null> {
    const order = await prisma.order.findFirst({
      where: { userId, status: 'DELIVERED', items: { some: { productId } } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return order?.id ?? null;
  }

  async function ownedReview(userId: string, id: string): Promise<ReviewRow> {
    const review = await prisma.review.findUnique({ where: { id }, include: reviewInclude });
    if (review === null) {
      throw notFound('Review');
    }
    if (review.userId !== userId) {
      throw forbidden('You can only change your own reviews.');
    }

    return review;
  }

  return {
    async list(productId: string, query: ReviewQuery): Promise<ProductReviewsDto> {
      await requireProduct(productId);
      const published = { productId, status: 'PUBLISHED' } as const;
      const where = query.rating === undefined ? published : { ...published, rating: query.rating };

      const [total, rows, groups] = await prisma.$transaction([
        prisma.review.count({ where }),
        prisma.review.findMany({
          where,
          include: reviewInclude,
          orderBy: ORDER_BY[query.sort],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        prisma.review.groupBy({
          by: ['rating'],
          where: published,
          orderBy: { rating: 'asc' },
          _count: { rating: true },
        }),
      ]);

      const distribution: ReviewSummaryDto['distribution'] = [0, 0, 0, 0, 0];
      let sum = 0;
      let count = 0;
      for (const group of groups) {
        const ratingCount = groupCount(group._count, 'rating');
        distribution[group.rating - 1] = ratingCount;
        sum += group.rating * ratingCount;
        count += ratingCount;
      }

      return {
        ...paginate(rows.map(toReview), total, query.page, query.limit),
        summary: {
          average: count === 0 ? 0 : Math.round((sum / count) * 10) / 10,
          count,
          distribution,
        },
      };
    },

    async eligibility(userId: string | null, productId: string): Promise<ReviewEligibilityDto> {
      await requireProduct(productId);
      if (userId === null) {
        return { canReview: false, reason: 'NOT_AUTHENTICATED', orderId: null };
      }

      const existing = await prisma.review.findUnique({
        where: { userId_productId: { userId, productId } },
        select: { id: true },
      });
      if (existing !== null) {
        return { canReview: false, reason: 'ALREADY_REVIEWED', orderId: null };
      }

      const orderId = await deliveredOrderId(userId, productId);
      return orderId === null
        ? { canReview: false, reason: 'NOT_PURCHASED', orderId: null }
        : { canReview: true, reason: null, orderId };
    },

    async create(userId: string, productId: string, input: ReviewInput): Promise<ReviewDto> {
      await requireProduct(productId);
      const orderId = await deliveredOrderId(userId, productId);
      if (orderId === null) {
        throw forbidden(
          'You can review products after they have been delivered to you.',
          'NOT_PURCHASED',
        );
      }

      try {
        const review = await prisma.$transaction(async (tx) => {
          const created = await tx.review.create({
            data: { ...input, userId, productId, orderId, verifiedPurchase: true },
            include: reviewInclude,
          });
          await refreshRating(tx, productId);
          return created;
        });
        return toReview(review);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw conflict('ALREADY_REVIEWED', 'You have already reviewed this product.');
        }
        throw error;
      }
    },

    async update(userId: string, id: string, input: UpdateReviewInput): Promise<ReviewDto> {
      const current = await ownedReview(userId, id);
      const data: Prisma.ReviewUpdateInput = {};
      if (input.rating !== undefined) data.rating = input.rating;
      if (input.title !== undefined) data.title = input.title;
      if (input.comment !== undefined) data.comment = input.comment;

      const review = await prisma.$transaction(async (tx) => {
        const updated = await tx.review.update({ where: { id }, data, include: reviewInclude });
        await refreshRating(tx, current.productId);
        return updated;
      });
      return toReview(review);
    },

    async remove(userId: string, id: string): Promise<void> {
      const current = await ownedReview(userId, id);
      await prisma.$transaction(async (tx) => {
        await tx.review.delete({ where: { id } });
        await refreshRating(tx, current.productId);
      });
    },
  };
}
