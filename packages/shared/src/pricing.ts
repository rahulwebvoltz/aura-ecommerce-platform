import { type CouponType, PRICING } from './constants.js';

export interface CouponRule {
  type: CouponType;
  /** Percentage points for PERCENTAGE coupons, minor units for FIXED coupons. */
  value: number;
  minimumOrderValue: number;
  maximumDiscount: number | null;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
}

/** Discount a coupon grants on a subtotal, never exceeding the subtotal itself. */
export function calculateCouponDiscount(rule: CouponRule, subtotal: number): number {
  if (subtotal <= 0 || subtotal < rule.minimumOrderValue) {
    return 0;
  }

  let discount: number;
  switch (rule.type) {
    case 'PERCENTAGE':
      discount = Math.floor((subtotal * rule.value) / 100);
      break;
    case 'FIXED':
      discount = rule.value;
      break;
  }

  if (rule.maximumDiscount !== null) {
    discount = Math.min(discount, rule.maximumDiscount);
  }

  return Math.min(discount, subtotal);
}

/** Flat-rate shipping that becomes free once the discounted subtotal crosses the threshold. */
export function calculateShipping(discountedSubtotal: number, itemCount: number): number {
  if (itemCount === 0 || discountedSubtotal >= PRICING.freeShippingThreshold) {
    return 0;
  }

  return PRICING.flatShippingFee;
}

/** GST on the discounted subtotal, rounded to the nearest minor unit. */
export function calculateTax(discountedSubtotal: number): number {
  return Math.round((discountedSubtotal * PRICING.taxRateBasisPoints) / 10_000);
}

/** Calculates order totals. The API is the only caller whose result is trusted. */
export function calculateOrderTotals(input: {
  subtotal: number;
  discount: number;
  itemCount: number;
}): OrderTotals {
  const discount = Math.min(Math.max(input.discount, 0), input.subtotal);
  const discountedSubtotal = input.subtotal - discount;
  const shipping = calculateShipping(discountedSubtotal, input.itemCount);
  const tax = calculateTax(discountedSubtotal);

  return {
    subtotal: input.subtotal,
    discount,
    shipping,
    tax,
    total: discountedSubtotal + shipping + tax,
  };
}

/** Amount still needed to qualify for free shipping. */
export function freeShippingRemaining(discountedSubtotal: number): number {
  return Math.max(PRICING.freeShippingThreshold - discountedSubtotal, 0);
}
