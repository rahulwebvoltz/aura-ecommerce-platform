import { describe, expect, it } from 'vitest';

import {
  addCartItemSchema,
  addressSchema,
  changePasswordSchema,
  checkoutSchema,
  idParamsSchema,
  issuesByField,
  loginSchema,
  mergeCartSchema,
  pageQuerySchema,
  productQuerySchema,
  registerSchema,
  resetPasswordSchema,
  reviewQuerySchema,
  reviewSchema,
  slugParamsSchema,
  updateAddressSchema,
  updateProfileSchema,
  updateReviewSchema,
  validateCouponSchema,
  verifyPaymentSchema,
} from './index.js';

const uuid = '0190a5f1-7c1e-7b3a-9f10-2b3c4d5e6f70';

const validAddress = {
  firstName: 'Asha',
  lastName: 'Rao',
  phone: '+91 98765 43210',
  addressLine1: '12 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560001',
};

describe('auth schemas', () => {
  it('normalises registration email and trims names', () => {
    const result = registerSchema.parse({
      email: '  Asha@Example.COM ',
      password: 'secret123',
      firstName: ' Asha ',
      lastName: 'Rao',
    });

    expect(result).toEqual({
      email: 'asha@example.com',
      password: 'secret123',
      firstName: 'Asha',
      lastName: 'Rao',
    });
  });

  it.each([
    ['short1', 'Password must be at least 8 characters.'],
    ['12345678', 'Password must contain a letter.'],
    ['abcdefgh', 'Password must contain a number.'],
  ])('rejects weak password %j', (password, message) => {
    const result = registerSchema.safeParse({
      email: 'a@example.com',
      password,
      firstName: 'A',
      lastName: 'B',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(issuesByField(result.error)['password']).toContain(message);
    }
  });

  it('rejects an invalid email and a missing name', () => {
    const result = registerSchema.safeParse({ email: 'nope', password: 'secret123', lastName: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = issuesByField(result.error);
      expect(fields['email']).toEqual(['Enter a valid email address.']);
      expect(fields['firstName']).toEqual(['First name is required.']);
      expect(fields['lastName']).toEqual(['Last name is required.']);
    }
  });

  it('requires a password on login', () => {
    expect(loginSchema.safeParse({ email: 'a@example.com', password: '' }).success).toBe(false);
    expect(loginSchema.parse({ email: 'A@example.com', password: 'x' }).email).toBe(
      'a@example.com',
    );
  });

  it('validates reset tokens', () => {
    expect(resetPasswordSchema.safeParse({ token: 'short', password: 'secret123' }).success).toBe(
      false,
    );
    expect(
      resetPasswordSchema.safeParse({ token: 'a'.repeat(64), password: 'secret123' }).success,
    ).toBe(true);
  });

  it('requires at least one profile field and accepts a null phone', () => {
    const empty = updateProfileSchema.safeParse({});
    expect(empty.success).toBe(false);
    if (!empty.success) {
      expect(issuesByField(empty.error)['_root']).toEqual([
        'Provide at least one field to update.',
      ]);
    }

    expect(updateProfileSchema.parse({ phone: null })).toEqual({ phone: null });
    expect(updateProfileSchema.safeParse({ phone: 'abc' }).success).toBe(false);
  });

  it('rejects reusing the current password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'secret123',
      newPassword: 'secret123',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(issuesByField(result.error)['newPassword']).toEqual([
        'New password must be different from the current password.',
      ]);
    }

    expect(
      changePasswordSchema.safeParse({ currentPassword: 'secret123', newPassword: 'secret456' })
        .success,
    ).toBe(true);
  });
});

describe('address schemas', () => {
  it('applies defaults and normalises optional text', () => {
    expect(addressSchema.parse({ ...validAddress, addressLine2: '  ', country: 'in' })).toEqual({
      ...validAddress,
      addressLine2: null,
      country: 'IN',
      isDefault: false,
    });
    expect(addressSchema.parse(validAddress).addressLine2).toBeNull();
    expect(addressSchema.parse({ ...validAddress, addressLine2: 'Floor 2' }).addressLine2).toBe(
      'Floor 2',
    );
  });

  it('rejects invalid postal codes and countries', () => {
    expect(addressSchema.safeParse({ ...validAddress, postalCode: '!' }).success).toBe(false);
    expect(addressSchema.safeParse({ ...validAddress, country: 'IND' }).success).toBe(false);
  });

  it('requires at least one field for updates', () => {
    expect(updateAddressSchema.safeParse({}).success).toBe(false);
    expect(updateAddressSchema.parse({ city: 'Mysuru' })).toEqual({ city: 'Mysuru' });
  });
});

describe('catalog query schema', () => {
  it('applies defaults', () => {
    expect(productQuerySchema.parse({})).toEqual({
      brand: [],
      inStock: false,
      sort: 'newest',
      page: 1,
      limit: 20,
      search: undefined,
      attributes: {},
    });
  });

  it('parses filters, lists, and variant attributes', () => {
    const query = productQuerySchema.parse({
      search: ' iphone ',
      category: 'Mobiles',
      brand: ['apple,samsung', 'oneplus'],
      minPrice: '10000',
      maxPrice: '100000',
      inStock: 'true',
      attr: ['Color:Black', 'color:Blue', 'size:XL'],
      sort: 'price_asc',
      page: '2',
      limit: '12',
    });

    expect(query).toMatchObject({
      search: 'iphone',
      category: 'mobiles',
      brand: ['apple', 'samsung', 'oneplus'],
      minPrice: 10_000,
      maxPrice: 100_000,
      inStock: true,
      sort: 'price_asc',
      page: 2,
      limit: 12,
      attributes: { color: ['Black', 'Blue'], size: ['XL'] },
    });
  });

  it('treats a blank search as absent and accepts a single attribute', () => {
    const query = productQuerySchema.parse({ search: '   ', attr: 'size:M' });
    expect(query.search).toBeUndefined();
    expect(query.attributes).toEqual({ size: ['M'] });
  });

  it('rejects inverted price ranges, bad sorts, and malformed attributes', () => {
    expect(productQuerySchema.safeParse({ minPrice: 10, maxPrice: 5 }).success).toBe(false);
    expect(productQuerySchema.safeParse({ sort: 'random' }).success).toBe(false);
    expect(productQuerySchema.safeParse({ attr: 'no-separator' }).success).toBe(false);
    expect(productQuerySchema.safeParse({ limit: 500 }).success).toBe(false);
  });
});

describe('shopping schemas', () => {
  it('defaults cart quantity and variant', () => {
    expect(addCartItemSchema.parse({ productId: uuid })).toEqual({
      productId: uuid,
      variantId: null,
      quantity: 1,
    });
  });

  it('enforces quantity bounds', () => {
    expect(addCartItemSchema.safeParse({ productId: uuid, quantity: 0 }).success).toBe(false);
    expect(addCartItemSchema.safeParse({ productId: uuid, quantity: 11 }).success).toBe(false);
    expect(addCartItemSchema.safeParse({ productId: uuid, quantity: 1.5 }).success).toBe(false);
  });

  it('limits merged guest carts', () => {
    const items = Array.from({ length: 51 }, () => ({ productId: uuid }));
    expect(mergeCartSchema.safeParse({ items }).success).toBe(false);
    expect(mergeCartSchema.parse({ items: items.slice(0, 2) }).items).toHaveLength(2);
  });

  it('normalises coupon codes', () => {
    expect(validateCouponSchema.parse({ code: ' welcome10 ' })).toEqual({ code: 'WELCOME10' });
    expect(validateCouponSchema.safeParse({ code: 'x' }).success).toBe(false);
  });

  it('accepts only references and choices at checkout', () => {
    const input = checkoutSchema.parse({
      shippingAddressId: uuid,
      paymentMethod: 'COD',
      total: 1,
    });

    expect(input).toEqual({
      shippingAddressId: uuid,
      billingAddressId: null,
      paymentMethod: 'COD',
      couponCode: null,
    });
    expect(
      checkoutSchema.safeParse({ shippingAddressId: uuid, paymentMethod: 'CARD' }).success,
    ).toBe(false);
  });

  it('validates Razorpay signatures', () => {
    const base = {
      orderId: uuid,
      razorpayOrderId: 'order_123',
      razorpayPaymentId: 'pay_123',
    };
    expect(verifyPaymentSchema.safeParse({ ...base, razorpaySignature: 'zz' }).success).toBe(false);
    expect(
      verifyPaymentSchema.safeParse({ ...base, razorpaySignature: 'a'.repeat(64) }).success,
    ).toBe(true);
  });
});

describe('review schemas', () => {
  it('validates ratings and text', () => {
    expect(reviewSchema.safeParse({ rating: 6, title: 'Hi', comment: 'Ok' }).success).toBe(false);
    expect(reviewSchema.parse({ rating: '5', title: ' Great ', comment: 'Loved it' })).toEqual({
      rating: 5,
      title: 'Great',
      comment: 'Loved it',
    });
  });

  it('requires at least one field for review updates', () => {
    expect(updateReviewSchema.safeParse({}).success).toBe(false);
    expect(updateReviewSchema.parse({ rating: 4 })).toEqual({ rating: 4 });
  });

  it('applies review query defaults', () => {
    expect(reviewQuerySchema.parse({})).toEqual({ page: 1, limit: 10, sort: 'newest' });
    expect(reviewQuerySchema.parse({ rating: '3', sort: 'lowest' })).toMatchObject({
      rating: 3,
      sort: 'lowest',
    });
  });
});

describe('common schemas', () => {
  it('validates identifiers and slugs', () => {
    expect(idParamsSchema.safeParse({ id: 'nope' }).success).toBe(false);
    expect(idParamsSchema.parse({ id: uuid })).toEqual({ id: uuid });
    expect(slugParamsSchema.parse({ slug: ' Mobiles ' })).toEqual({ slug: 'mobiles' });
    expect(slugParamsSchema.safeParse({ slug: 'bad slug' }).success).toBe(false);
  });

  it('applies page defaults', () => {
    expect(pageQuerySchema.parse({})).toEqual({ page: 1, limit: 10 });
  });
});
