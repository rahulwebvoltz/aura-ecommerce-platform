import { CART_LIMITS, PAYMENT_METHODS } from '@ecommerce/shared';
import { z } from 'zod';

import { idSchema, requiredText } from './common.js';

const quantitySchema = z.coerce
  .number()
  .int({ error: 'Quantity must be a whole number.' })
  .min(1, { error: 'Quantity must be at least 1.' })
  .max(CART_LIMITS.maxQuantityPerItem, {
    error: `You can add at most ${String(CART_LIMITS.maxQuantityPerItem)} of an item.`,
  });

export const addCartItemSchema = z.object({
  productId: idSchema,
  variantId: idSchema.nullish().transform((value) => value ?? null),
  quantity: quantitySchema.default(1),
});
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z.object({ quantity: quantitySchema });
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

export const mergeCartSchema = z.object({
  items: z.array(addCartItemSchema).max(CART_LIMITS.maxDistinctItems),
});
export type MergeCartInput = z.infer<typeof mergeCartSchema>;

export const couponCodeSchema = z
  .string({ error: 'Coupon code is required.' })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,32}$/u, { error: 'Enter a valid coupon code.' });

export const validateCouponSchema = z.object({ code: couponCodeSchema });
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;

/**
 * Checkout accepts only references and choices. Prices, discounts, tax, shipping, totals and
 * stock are always recalculated by the API.
 */
export const checkoutSchema = z.object({
  shippingAddressId: idSchema,
  billingAddressId: idSchema.nullish().transform((value) => value ?? null),
  paymentMethod: z.enum(PAYMENT_METHODS),
  couponCode: couponCodeSchema.nullish().transform((value) => value ?? null),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const createPaymentSchema = z.object({ orderId: idSchema });
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const verifyPaymentSchema = z.object({
  orderId: idSchema,
  razorpayOrderId: requiredText(64, 'Razorpay order id'),
  razorpayPaymentId: requiredText(64, 'Razorpay payment id'),
  razorpaySignature: z.string().regex(/^[a-f0-9]{64}$/u, { error: 'Invalid payment signature.' }),
});
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

export const cancelOrderSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, 'Choose a rating.').max(5),
  title: requiredText(120, 'Title'),
  comment: requiredText(2_000, 'Review'),
});
export type ReviewInput = z.infer<typeof reviewSchema>;

export const updateReviewSchema = reviewSchema
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    error: 'Provide at least one field to update.',
  });
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

export const reviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(['newest', 'highest', 'lowest']).default('newest'),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});
export type ReviewQuery = z.infer<typeof reviewQuerySchema>;
