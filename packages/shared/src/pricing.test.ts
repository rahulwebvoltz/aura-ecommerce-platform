import { describe, expect, it } from 'vitest';

import {
  calculateCouponDiscount,
  calculateOrderTotals,
  calculateShipping,
  calculateTax,
  type CouponRule,
  freeShippingRemaining,
  PRICING,
} from './index.js';

const percentage: CouponRule = {
  type: 'PERCENTAGE',
  value: 10,
  minimumOrderValue: 100_000,
  maximumDiscount: 50_000,
};

const fixed: CouponRule = {
  type: 'FIXED',
  value: 20_000,
  minimumOrderValue: 0,
  maximumDiscount: null,
};

describe('calculateCouponDiscount', () => {
  it('applies a percentage and rounds down', () => {
    expect(calculateCouponDiscount(percentage, 123_456)).toBe(12_345);
  });

  it('caps percentage discounts at the maximum', () => {
    expect(calculateCouponDiscount(percentage, 1_000_000)).toBe(50_000);
  });

  it('returns zero below the minimum order value or for empty carts', () => {
    expect(calculateCouponDiscount(percentage, 99_999)).toBe(0);
    expect(calculateCouponDiscount(fixed, 0)).toBe(0);
  });

  it('never discounts more than the subtotal', () => {
    expect(calculateCouponDiscount(fixed, 15_000)).toBe(15_000);
    expect(calculateCouponDiscount(fixed, 50_000)).toBe(20_000);
  });

  it('caps fixed discounts when a maximum is configured', () => {
    expect(calculateCouponDiscount({ ...fixed, maximumDiscount: 5_000 }, 50_000)).toBe(5_000);
  });
});

describe('shipping and tax', () => {
  it('charges flat shipping below the threshold and nothing at or above it', () => {
    expect(calculateShipping(PRICING.freeShippingThreshold - 1, 1)).toBe(PRICING.flatShippingFee);
    expect(calculateShipping(PRICING.freeShippingThreshold, 1)).toBe(0);
    expect(calculateShipping(10_000, 0)).toBe(0);
  });

  it('applies GST and rounds to the nearest paisa', () => {
    expect(calculateTax(100_000)).toBe(18_000);
    expect(calculateTax(333)).toBe(60);
  });

  it('reports the amount left for free shipping', () => {
    expect(freeShippingRemaining(90_000)).toBe(PRICING.freeShippingThreshold - 90_000);
    expect(freeShippingRemaining(200_000)).toBe(0);
  });
});

describe('calculateOrderTotals', () => {
  it('combines discount, shipping, and tax', () => {
    expect(calculateOrderTotals({ subtotal: 150_000, discount: 20_000, itemCount: 2 })).toEqual({
      subtotal: 150_000,
      discount: 20_000,
      shipping: 0,
      tax: 23_400,
      total: 153_400,
    });
  });

  it('adds shipping when the discounted subtotal drops below the threshold', () => {
    const totals = calculateOrderTotals({ subtotal: 100_000, discount: 10_000, itemCount: 1 });
    expect(totals.shipping).toBe(PRICING.flatShippingFee);
    expect(totals.total).toBe(90_000 + PRICING.flatShippingFee + 16_200);
  });

  it('clamps invalid discounts', () => {
    expect(calculateOrderTotals({ subtotal: 5_000, discount: 9_000, itemCount: 1 }).discount).toBe(
      5_000,
    );
    expect(calculateOrderTotals({ subtotal: 5_000, discount: -1, itemCount: 1 }).discount).toBe(0);
  });
});
