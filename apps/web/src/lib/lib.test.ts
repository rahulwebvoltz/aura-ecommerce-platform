import { describe, expect, it } from 'vitest';

import { ApiError } from '@/services/api-client';

import { parseAppEnv } from './env';
import { createQueryClient, errorMessage, queryKeys } from './query';
import {
  cn,
  formatAttributes,
  formatDate,
  formatDateTime,
  humanize,
  idempotencyKey,
  pluralize,
} from './utils';

describe('public configuration', () => {
  it('validates and normalises the API URL', () => {
    expect(
      parseAppEnv({ VITE_API_BASE_URL: 'https://api.example.test/', VITE_APP_ENV: 'production' }),
    ).toEqual({ VITE_API_BASE_URL: 'https://api.example.test', VITE_APP_ENV: 'production' });
  });

  it.each(['definitely not a URL', 'ftp://api.example.test'])(
    'fails generically for %s',
    (value) => {
      let failure: unknown;
      try {
        parseAppEnv({ VITE_API_BASE_URL: value, VITE_APP_ENV: 'test' });
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(Error);
      expect(String(failure)).toBe('Error: Invalid application configuration.');
      expect(String(failure)).not.toContain(value);
    },
  );
});

describe('formatting helpers', () => {
  it('merges class names with later Tailwind utilities winning', () => {
    const hidden = document.hidden;
    expect(cn('px-2 text-sm', hidden && 'hidden', 'px-4')).toBe('text-sm px-4');
  });

  it('formats dates in the Indian locale', () => {
    expect(formatDate('2026-09-24T10:00:00.000Z')).toBe('24 Sept 2026');
    expect(formatDateTime('2026-09-24T10:00:00.000Z')).toContain('24 Sept 2026');
  });

  it('formats variant attributes', () => {
    expect(formatAttributes({ color: 'Black', storage: '128GB' })).toBe('Black · 128GB');
    expect(formatAttributes(null)).toBe('');
    expect(formatAttributes(undefined)).toBe('');
  });

  it('humanises keys and pluralises counts', () => {
    expect(humanize('IN_PROGRESS')).toBe('In progress');
    expect(humanize('storage')).toBe('Storage');
    expect(pluralize(1, 'item')).toBe('1 item');
    expect(pluralize(3, 'item')).toBe('3 items');
    expect(pluralize(2, 'box', 'boxes')).toBe('2 boxes');
  });

  it('creates unique idempotency keys', () => {
    expect(idempotencyKey()).not.toBe(idempotencyKey());
  });
});

describe('query setup', () => {
  it('does not retry client errors but retries other failures twice', () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry;
    if (typeof retry !== 'function') {
      throw new Error('Expected a retry function.');
    }

    expect(retry(0, new ApiError(404, 'NOT_FOUND', 'Missing'))).toBe(false);
    expect(retry(0, new ApiError(503, 'DOWN', 'Down'))).toBe(true);
    expect(retry(1, new Error('network'))).toBe(true);
    expect(retry(2, new Error('network'))).toBe(false);
  });

  it('builds stable query keys', () => {
    expect(queryKeys.category('phones')).toEqual(['category', 'phones']);
    expect(queryKeys.products({ sort: 'newest' })).toEqual(['products', { sort: 'newest' }]);
    expect(queryKeys.facets({ search: 'x' })).toEqual(['facets', { search: 'x' }]);
    expect(queryKeys.product('p')).toEqual(['product', 'p']);
    expect(queryKeys.related('p')).toEqual(['related', 'p']);
    expect(queryKeys.reviews('p', { page: 1 })).toEqual(['reviews', 'p', { page: 1 }]);
    expect(queryKeys.reviewEligibility('p')).toEqual(['review-eligibility', 'p']);
    expect(queryKeys.orders(2)).toEqual(['orders', 2]);
    expect(queryKeys.order('o')).toEqual(['order', 'o']);
  });

  it('turns any failure into a readable message', () => {
    expect(errorMessage(new ApiError(409, 'X', 'Only 2 left.'))).toBe('Only 2 left.');
    expect(errorMessage(new Error('internal detail'))).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
