import { describe, expect, it } from 'vitest';

import {
  CANCELLABLE_ORDER_STATUSES,
  discountPercent,
  formatMoney,
  ORDER_STATUSES,
  SLUG_PATTERN,
  slugify,
  toMajorUnits,
  toMinorUnits,
} from './index.js';

describe('money helpers', () => {
  it('formats whole rupee amounts without decimals', () => {
    expect(formatMoney(129_900)).toBe('₹1,299');
  });

  it('formats fractional amounts with two decimals and reuses formatters', () => {
    expect(formatMoney(12_345)).toBe('₹123.45');
    expect(formatMoney(99)).toBe('₹0.99');
  });

  it('formats other currencies', () => {
    expect(formatMoney(1_000, 'USD')).toBe('$10');
  });

  it('converts between major and minor units without float drift', () => {
    expect(toMinorUnits(19.99)).toBe(1_999);
    expect(toMinorUnits(0.1 + 0.2)).toBe(30);
    expect(toMajorUnits(1_999)).toBe(19.99);
  });

  it.each([
    [800, 1_000, 20],
    [999, 1_000, 0],
    [1_000, 1_000, 0],
    [1_000, null, 0],
    [0, 0, 0],
    [667, 1_000, 33],
  ] as const)('discountPercent(%d, %s) is %d', (price, compareAt, expected) => {
    expect(discountPercent(price, compareAt)).toBe(expected);
  });
});

describe('slug helpers', () => {
  it.each([
    ['iPhone 15 Pro Max', 'iphone-15-pro-max'],
    ['  Home & Kitchen  ', 'home-and-kitchen'],
    ['Café Crème', 'cafe-creme'],
    ['--Already--slugged--', 'already-slugged'],
  ])('slugify(%j) is %j', (input, expected) => {
    const slug = slugify(input);
    expect(slug).toBe(expected);
    expect(SLUG_PATTERN.test(slug)).toBe(true);
  });

  it('rejects malformed slugs', () => {
    expect(SLUG_PATTERN.test('Not A Slug')).toBe(false);
    expect(SLUG_PATTERN.test('trailing-')).toBe(false);
  });
});

describe('order status rules', () => {
  it('only allows cancellation before processing starts', () => {
    expect(CANCELLABLE_ORDER_STATUSES).toEqual(['PENDING', 'CONFIRMED']);
    expect(CANCELLABLE_ORDER_STATUSES.every((status) => ORDER_STATUSES.includes(status))).toBe(
      true,
    );
  });
});
