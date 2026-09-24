import type { Coupon, Prisma } from '@ecommerce/db';
import { calculateCouponDiscount, formatMoney } from '@ecommerce/shared';
import type { CouponValidationDto } from '@ecommerce/types';

import { notFound, unprocessable } from '../../utils/errors.js';

type CouponReader = Pick<Prisma.TransactionClient, 'coupon'>;

export interface AppliedCoupon {
  coupon: Coupon;
  discount: number;
}

function describe(coupon: Coupon): string {
  if (coupon.description !== null) {
    return coupon.description;
  }

  switch (coupon.type) {
    case 'PERCENTAGE':
      return `${String(coupon.value)}% off`;
    case 'FIXED':
      return `${formatMoney(coupon.value)} off`;
  }
}

/**
 * Checks every coupon rule against a server-calculated subtotal. Errors carry specific codes so
 * the storefront can explain why a code was rejected.
 */
export async function applyCoupon(
  db: CouponReader,
  code: string,
  subtotal: number,
  now: Date,
): Promise<AppliedCoupon> {
  const coupon = await db.coupon.findUnique({ where: { code } });
  if (coupon === null) {
    throw notFound('Coupon');
  }
  if (coupon.status !== 'ACTIVE') {
    throw unprocessable('COUPON_INACTIVE', 'This coupon is no longer active.');
  }
  if (coupon.startsAt !== null && coupon.startsAt > now) {
    throw unprocessable('COUPON_NOT_STARTED', 'This coupon is not active yet.');
  }
  if (coupon.expiresAt !== null && coupon.expiresAt <= now) {
    throw unprocessable('COUPON_EXPIRED', 'This coupon has expired.');
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw unprocessable('COUPON_EXHAUSTED', 'This coupon has reached its usage limit.');
  }
  if (subtotal < coupon.minimumOrderValue) {
    throw unprocessable(
      'COUPON_MINIMUM_NOT_MET',
      `Add ${formatMoney(coupon.minimumOrderValue - subtotal)} more to use this coupon.`,
    );
  }

  return { coupon, discount: calculateCouponDiscount(coupon, subtotal) };
}

export function toCouponValidation({ coupon, discount }: AppliedCoupon): CouponValidationDto {
  return {
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    discount,
    description: describe(coupon),
  };
}

/** Atomically claims one use of a coupon. Returns false when the limit was reached concurrently. */
export async function redeemCoupon(
  tx: Prisma.TransactionClient,
  couponId: string,
): Promise<boolean> {
  const result = await tx.coupon.updateMany({
    where: {
      id: couponId,
      OR: [{ usageLimit: null }, { usedCount: { lt: tx.coupon.fields.usageLimit } }],
    },
    data: { usedCount: { increment: 1 } },
  });

  return result.count === 1;
}

export async function releaseCoupon(tx: Prisma.TransactionClient, couponId: string): Promise<void> {
  await tx.coupon.updateMany({
    where: { id: couponId, usedCount: { gt: 0 } },
    data: { usedCount: { decrement: 1 } },
  });
}
