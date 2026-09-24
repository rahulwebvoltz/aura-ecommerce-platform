import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';
import { API, fail, mockFetch, ok, type RecordedCall, session } from '@/test/utils';

import { api } from './api';
import { authApi } from './auth.api';
import { catalogApi, reviewsApi } from './catalog.api';
import { addressesApi, cartApi, checkoutApi, ordersApi, wishlistApi } from './shopping.api';

const uuid = '0190a5f1-7c1e-7b3a-9f10-2b3c4d5e6f70';

/** Each endpoint function paired with the request it must send. */
const ENDPOINTS: [string, () => Promise<unknown>, string, string][] = [
  [
    'register',
    () =>
      authApi.register({
        email: 'a@example.com',
        password: 'Secret123',
        firstName: 'A',
        lastName: 'B',
      }),
    'POST',
    '/auth/register',
  ],
  ['login', () => authApi.login({ email: 'a@example.com', password: 'x' }), 'POST', '/auth/login'],
  ['refresh', () => authApi.refresh(), 'POST', '/auth/refresh'],
  ['logout', () => authApi.logout(), 'POST', '/auth/logout'],
  ['me', () => authApi.me(), 'GET', '/auth/me'],
  ['updateProfile', () => authApi.updateProfile({ firstName: 'A' }), 'PATCH', '/auth/me'],
  [
    'changePassword',
    () => authApi.changePassword({ currentPassword: 'a', newPassword: 'Secret123' }),
    'POST',
    '/auth/change-password',
  ],
  [
    'forgotPassword',
    () => authApi.forgotPassword('a@example.com'),
    'POST',
    '/auth/forgot-password',
  ],
  [
    'resetPassword',
    () => authApi.resetPassword({ token: 't', password: 'Secret123' }),
    'POST',
    '/auth/reset-password',
  ],
  ['verifyEmail', () => authApi.verifyEmail('t'), 'POST', '/auth/verify-email'],
  ['resendVerification', () => authApi.resendVerification(), 'POST', '/auth/verify-email/resend'],
  [
    'products',
    () => catalogApi.products({ brand: ['a', 'b'], attr: ['color:Black'], sort: 'rating' }),
    'GET',
    '/products?brand=a%2Cb&attr=color%3ABlack&sort=rating',
  ],
  ['products (no brand)', () => catalogApi.products({}), 'GET', '/products'],
  [
    'facets',
    () => catalogApi.facets({ category: 'phones' }),
    'GET',
    '/products/facets?category=phones',
  ],
  ['product', () => catalogApi.product('a b'), 'GET', '/products/a%20b'],
  ['related', () => catalogApi.related('phone'), 'GET', '/products/phone/related'],
  ['categories', () => catalogApi.categories(), 'GET', '/categories'],
  ['category', () => catalogApi.category('phones'), 'GET', '/categories/phones'],
  ['brands', () => catalogApi.brands(), 'GET', '/brands'],
  [
    'reviews',
    () => reviewsApi.list(uuid, { page: 2, sort: 'lowest', rating: 4 }),
    'GET',
    `/products/${uuid}/reviews?page=2&sort=lowest&rating=4&limit=5`,
  ],
  [
    'eligibility',
    () => reviewsApi.eligibility(uuid),
    'GET',
    `/products/${uuid}/reviews/eligibility`,
  ],
  [
    'createReview',
    () => reviewsApi.create(uuid, { rating: 5, title: 't', comment: 'c' }),
    'POST',
    `/products/${uuid}/reviews`,
  ],
  ['updateReview', () => reviewsApi.update('r1', { rating: 4 }), 'PATCH', '/reviews/r1'],
  ['removeReview', () => reviewsApi.remove('r1'), 'DELETE', '/reviews/r1'],
  ['cart', () => cartApi.get(), 'GET', '/cart'],
  ['addToCart', () => cartApi.add({ productId: uuid, quantity: 1 }), 'POST', '/cart/items'],
  ['updateCart', () => cartApi.update('l1', 2), 'PATCH', '/cart/items/l1'],
  ['removeFromCart', () => cartApi.remove('l1'), 'DELETE', '/cart/items/l1'],
  ['clearCart', () => cartApi.clear(), 'DELETE', '/cart'],
  ['mergeCart', () => cartApi.merge({ items: [] }), 'POST', '/cart/merge'],
  ['wishlist', () => wishlistApi.get(), 'GET', '/wishlist'],
  ['saveToWishlist', () => wishlistApi.add(uuid), 'POST', `/wishlist/${uuid}`],
  ['removeFromWishlist', () => wishlistApi.remove(uuid), 'DELETE', `/wishlist/${uuid}`],
  ['addresses', () => addressesApi.list(), 'GET', '/addresses'],
  [
    'createAddress',
    () =>
      addressesApi.create({
        firstName: 'A',
        lastName: 'B',
        phone: '1',
        addressLine1: 'x',
        addressLine2: null,
        city: 'c',
        state: 's',
        postalCode: '560001',
      }),
    'POST',
    '/addresses',
  ],
  ['updateAddress', () => addressesApi.update('a1', { city: 'c' }), 'PATCH', '/addresses/a1'],
  ['removeAddress', () => addressesApi.remove('a1'), 'DELETE', '/addresses/a1'],
  [
    'validateCoupon',
    () => checkoutApi.validateCoupon('WELCOME10'),
    'POST',
    '/checkout/validate-coupon',
  ],
  [
    'placeOrder',
    () =>
      checkoutApi.placeOrder(
        { shippingAddressId: uuid, billingAddressId: null, paymentMethod: 'COD', couponCode: null },
        'key-123456',
      ),
    'POST',
    '/checkout',
  ],
  ['paymentMethods', () => checkoutApi.paymentMethods(), 'GET', '/payments/methods'],
  ['createPayment', () => checkoutApi.createPayment(uuid), 'POST', '/payments/create'],
  [
    'verifyPayment',
    () =>
      checkoutApi.verifyPayment({
        orderId: uuid,
        razorpayOrderId: 'o',
        razorpayPaymentId: 'p',
        razorpaySignature: 's',
      }),
    'POST',
    '/payments/verify',
  ],
  ['orders', () => ordersApi.list(3), 'GET', '/orders?page=3&limit=10'],
  ['order', () => ordersApi.get('o1'), 'GET', '/orders/o1'],
  ['cancelOrder', () => ordersApi.cancel('o1', 'Changed my mind'), 'POST', '/orders/o1/cancel'],
  ['cancelOrder (no reason)', () => ordersApi.cancel('o1'), 'POST', '/orders/o1/cancel'],
];

beforeEach(() => {
  useAuthStore.setState({ status: 'anonymous', user: null, accessToken: null });
});
afterEach(() => {
  localStorage.clear();
});

describe('endpoint modules', () => {
  it.each(ENDPOINTS)('%s sends %s %s', async (_name, invoke, method, path) => {
    const { calls } = mockFetch(() => new Response(null, { status: 204 }));
    // Responses are empty, so typed endpoints reject on the contract check; only the request matters.
    await invoke().catch(() => undefined);

    const call: RecordedCall | undefined = calls[0];
    expect(call?.method).toBe(method);
    expect(call?.url).toBe(`${API}${path}`);
  });

  it('sends the idempotency key and cancel reason', async () => {
    const { calls } = mockFetch(() => new Response(null, { status: 204 }));
    await checkoutApi
      .placeOrder(
        { shippingAddressId: uuid, billingAddressId: null, paymentMethod: 'COD', couponCode: null },
        'key-abcdefgh',
      )
      .catch(() => undefined);
    await ordersApi.cancel('o1', 'Too slow').catch(() => undefined);
    await ordersApi.cancel('o1').catch(() => undefined);

    expect(calls[0]?.headers['idempotency-key']).toBe('key-abcdefgh');
    expect(calls[1]?.body).toEqual({ reason: 'Too slow' });
    expect(calls[2]?.body).toEqual({});
  });
});

describe('shared client session renewal', () => {
  it('stores the renewed session and retries the request', async () => {
    const { calls } = mockFetch((call) => {
      if (call.url.endsWith('/auth/refresh')) {
        return ok(session);
      }
      return call.headers['authorization'] === `Bearer ${session.accessToken}`
        ? ok({ message: 'hi' })
        : fail(401, 'UNAUTHORIZED', 'Expired');
    });

    await expect(authApi.resendVerification()).resolves.toEqual({ message: 'hi' });
    expect(calls.map((call) => call.url.replace(API, ''))).toEqual([
      '/auth/verify-email/resend',
      '/auth/refresh',
      '/auth/verify-email/resend',
    ]);
    expect(useAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      accessToken: 'token-1',
    });
  });

  it('signs the shopper out when the session cannot be renewed', async () => {
    useAuthStore.setState({ status: 'authenticated', accessToken: 'stale' });
    mockFetch(() => fail(401, 'SESSION_EXPIRED', 'Expired'));

    await expect(api.send('/cart')).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore.getState()).toMatchObject({ status: 'anonymous', accessToken: null });
  });
});
