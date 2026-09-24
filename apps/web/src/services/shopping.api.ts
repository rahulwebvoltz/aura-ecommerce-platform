import {
  addressResponseSchema,
  cartSchema,
  checkoutResultSchema,
  couponValidationSchema,
  orderDetailSchema,
  orderSummarySchema,
  paginatedSchema,
  paymentInitSchema,
  paymentMethodsSchema,
  wishlistSchema,
} from '@ecommerce/types';
import type {
  AddCartItemInput,
  AddressFormValues,
  CheckoutInput,
  MergeCartInput,
  UpdateAddressInput,
  VerifyPaymentInput,
} from '@ecommerce/validation';
import { z } from 'zod';

import { api } from './api';

export const cartApi = {
  get: () => api.request('/cart', cartSchema),
  add: (input: Omit<AddCartItemInput, 'variantId'> & { variantId?: string | null }) =>
    api.request('/cart/items', cartSchema, { method: 'POST', body: input }),
  update: (itemId: string, quantity: number) =>
    api.request(`/cart/items/${itemId}`, cartSchema, { method: 'PATCH', body: { quantity } }),
  remove: (itemId: string) =>
    api.request(`/cart/items/${itemId}`, cartSchema, { method: 'DELETE' }),
  clear: () => api.request('/cart', cartSchema, { method: 'DELETE' }),
  merge: (input: MergeCartInput) =>
    api.request('/cart/merge', cartSchema, { method: 'POST', body: input }),
};

export const wishlistApi = {
  get: () => api.request('/wishlist', wishlistSchema),
  add: (productId: string) =>
    api.request(`/wishlist/${productId}`, wishlistSchema, { method: 'POST' }),
  remove: (productId: string) =>
    api.request(`/wishlist/${productId}`, wishlistSchema, { method: 'DELETE' }),
};

export const addressesApi = {
  list: () => api.request('/addresses', z.array(addressResponseSchema)),
  create: (input: AddressFormValues) =>
    api.request('/addresses', addressResponseSchema, { method: 'POST', body: input }),
  update: (id: string, input: UpdateAddressInput) =>
    api.request(`/addresses/${id}`, addressResponseSchema, { method: 'PATCH', body: input }),
  remove: (id: string) => api.send(`/addresses/${id}`, { method: 'DELETE' }),
};

export const checkoutApi = {
  validateCoupon: (code: string) =>
    api.request('/checkout/validate-coupon', couponValidationSchema, {
      method: 'POST',
      body: { code },
    }),
  placeOrder: (input: CheckoutInput, idempotencyKey: string) =>
    api.request('/checkout', checkoutResultSchema, {
      method: 'POST',
      body: input,
      headers: { 'idempotency-key': idempotencyKey },
    }),
  paymentMethods: () => api.request('/payments/methods', paymentMethodsSchema),
  createPayment: (orderId: string) =>
    api.request('/payments/create', paymentInitSchema, { method: 'POST', body: { orderId } }),
  verifyPayment: (input: VerifyPaymentInput) =>
    api.request('/payments/verify', orderDetailSchema, { method: 'POST', body: input }),
};

const orderPageSchema = paginatedSchema(orderSummarySchema);

export const ordersApi = {
  list: (page: number) =>
    api.requestRaw('/orders', orderPageSchema, { query: { page, limit: 10 } }),
  get: (id: string) => api.request(`/orders/${id}`, orderDetailSchema),
  cancel: (id: string, reason?: string) =>
    api.request(`/orders/${id}/cancel`, orderDetailSchema, {
      method: 'POST',
      body: reason === undefined ? {} : { reason },
    }),
};
