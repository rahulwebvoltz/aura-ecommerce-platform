export const USER_ROLES = ['CUSTOMER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const RECORD_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Orders in these states can still be cancelled by the customer. */
export const CANCELLABLE_ORDER_STATUSES: readonly OrderStatus[] = ['PENDING', 'CONFIRMED'];

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const FULFILLMENT_STATUSES = ['UNFULFILLED', 'PARTIALLY_FULFILLED', 'FULFILLED'] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['COD', 'RAZORPAY'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const COUPON_TYPES = ['PERCENTAGE', 'FIXED'] as const;
export type CouponType = (typeof COUPON_TYPES)[number];

export const REVIEW_STATUSES = ['PENDING', 'PUBLISHED', 'REJECTED'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const PRODUCT_SORTS = [
  'newest',
  'price_asc',
  'price_desc',
  'rating',
  'name_asc',
  'popular',
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const PAGINATION = {
  defaultLimit: 20,
  maxLimit: 60,
} as const;

export const CART_LIMITS = {
  maxQuantityPerItem: 10,
  maxDistinctItems: 50,
} as const;

/**
 * Pricing rules shared so the storefront can show hints such as free-shipping progress.
 * The API is the only place totals are actually calculated.
 */
export const PRICING = {
  currency: 'INR',
  /** Orders at or above this taxable amount (in paise) ship for free. */
  freeShippingThreshold: 99_900,
  /** Flat shipping fee in paise below the free-shipping threshold. */
  flatShippingFee: 7_900,
  /** GST applied to the discounted subtotal, in basis points (1800 = 18%). */
  taxRateBasisPoints: 1_800,
} as const;
