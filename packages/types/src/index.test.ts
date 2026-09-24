import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  AddressDto,
  AddressSnapshot,
  ApiErrorBody,
  PaymentInitDto,
  ProductDetailDto,
  ProductSummaryDto,
  ReviewSummaryDto,
} from './index.js';
import {
  apiErrorBodySchema,
  apiSuccessSchema,
  categorySchema,
  checkoutResultSchema,
  paginatedSchema,
  paymentInitSchema,
  productSummarySchema,
} from './index.js';

describe('API contract types', () => {
  it('keeps address snapshots free of mutable address metadata', () => {
    expectTypeOf<AddressSnapshot>().not.toHaveProperty('id');
    expectTypeOf<AddressSnapshot>().not.toHaveProperty('isDefault');
    expectTypeOf<AddressSnapshot>().toHaveProperty('postalCode').toEqualTypeOf<string>();
    expectTypeOf<AddressDto>().toExtend<AddressSnapshot>();
  });

  it('extends product summaries into product details', () => {
    expectTypeOf<ProductDetailDto>().toExtend<ProductSummaryDto>();
    expectTypeOf<ProductDetailDto['variants'][number]['price']>().toEqualTypeOf<number>();
  });

  it('discriminates payment initialisation by provider', () => {
    expectTypeOf<PaymentInitDto['provider']>().toEqualTypeOf<'RAZORPAY' | 'COD'>();
    expectTypeOf<Extract<PaymentInitDto, { provider: 'RAZORPAY' }>>()
      .toHaveProperty('providerOrderId')
      .toEqualTypeOf<string>();
  });

  it('models a five-bucket rating distribution', () => {
    expectTypeOf<ReviewSummaryDto['distribution']>().toEqualTypeOf<
      [number, number, number, number, number]
    >();
  });

  it('keeps error details optional', () => {
    expectTypeOf<ApiErrorBody['error']['details']>().toEqualTypeOf<
      Record<string, string[]> | undefined
    >();
  });
});

describe('API contract schemas', () => {
  const image = { id: 'i1', url: 'https://example.test/a.jpg', alt: null, sortOrder: 0 };
  const summary = {
    id: 'p1',
    name: 'Phone',
    slug: 'phone',
    shortDescription: null,
    price: 100,
    compareAtPrice: null,
    stock: 1,
    ratingAverage: 4.5,
    ratingCount: 2,
    image,
    hoverImage: null,
    category: { id: 'c1', name: 'Phones', slug: 'phones' },
    brand: null,
    hasVariants: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  it('wraps payloads in success and paginated envelopes', () => {
    expect(apiSuccessSchema(productSummarySchema).parse({ data: summary }).data.name).toBe('Phone');
    const page = paginatedSchema(productSummarySchema).parse({
      data: [summary],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(page.data).toHaveLength(1);
  });

  it('parses recursive category trees', () => {
    const tree = categorySchema.parse({
      id: 'c1',
      name: 'Electronics',
      slug: 'electronics',
      description: null,
      image: null,
      parentId: null,
      productCount: 1,
      children: [
        {
          id: 'c2',
          name: 'Phones',
          slug: 'phones',
          description: null,
          image: null,
          parentId: 'c1',
          productCount: 1,
          children: [],
        },
      ],
    });
    expect(tree.children[0]?.slug).toBe('phones');
  });

  it('discriminates payment initialisation at runtime', () => {
    expect(checkoutResultSchema.shape.payment.parse({ provider: 'COD' })).toEqual({
      provider: 'COD',
    });
    expect(paymentInitSchema.safeParse({ provider: 'CARD' }).success).toBe(false);
  });

  it('rejects contract drift', () => {
    expect(productSummarySchema.safeParse({ ...summary, price: '100' }).success).toBe(false);
    expect(apiErrorBodySchema.parse({ error: { code: 'X', message: 'Y' } }).error.details).toBe(
      undefined,
    );
  });
});
