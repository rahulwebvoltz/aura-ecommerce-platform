import type {
  AuthSessionDto,
  CartDto,
  CartItemDto,
  ProductSummaryDto,
  WishlistDto,
} from '@ecommerce/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

export const API = 'http://api.example.test/api';

export interface RecordedCall {
  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
}

type Handler = (call: RecordedCall) => Response | Promise<Response>;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const ok = (data: unknown) => json({ data });
export const fail = (
  status: number,
  code: string,
  message = 'Failed.',
  details?: Record<string, string[]>,
) =>
  json({ error: details === undefined ? { code, message } : { code, message, details } }, status);

/** Replaces global fetch with a handler and records every call. */
export function mockFetch(handler: Handler) {
  const calls: RecordedCall[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    const headers = new Headers(init?.headers);
    const call: RecordedCall = {
      url,
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
      headers: Object.fromEntries(headers.entries()),
    };
    calls.push(call);
    return handler(call);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
}

export function wrapperFor(client: QueryClient, initialPath = '/') {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

export const user = {
  id: 'u1',
  email: 'asha@example.com',
  firstName: 'Asha',
  lastName: 'Rao',
  phone: null,
  role: 'CUSTOMER' as const,
  emailVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const session: AuthSessionDto = { user, accessToken: 'token-1', expiresIn: 900 };

export const product: ProductSummaryDto = {
  id: 'p1',
  name: 'Phone',
  slug: 'phone',
  shortDescription: null,
  price: 10_000,
  compareAtPrice: 12_000,
  stock: 4,
  ratingAverage: 4.5,
  ratingCount: 2,
  image: { id: 'i1', url: 'https://img.example.test/p.png', alt: null, sortOrder: 0 },
  hoverImage: null,
  category: { id: 'c1', name: 'Phones', slug: 'phones' },
  brand: { id: 'b1', name: 'Acme', slug: 'acme' },
  hasVariants: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export function cartItem(overrides: Partial<CartItemDto> = {}): CartItemDto {
  return {
    id: 'line-1',
    quantity: 1,
    unitPrice: 10_000,
    compareAtPrice: null,
    lineTotal: 10_000,
    priceChanged: false,
    availableStock: 5,
    product: { id: 'p1', name: 'Phone', slug: 'phone', image: null, brand: 'Acme' },
    variant: null,
    ...overrides,
  };
}

export function cart(items: CartItemDto[]): CartDto {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return {
    id: 'cart-1',
    items,
    summary: {
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      freeShippingRemaining: Math.max(99_900 - subtotal, 0),
    },
  };
}

export function wishlist(products: ProductSummaryDto[]): WishlistDto {
  return {
    id: 'w1',
    items: products.map((entry, index) => ({
      id: `wi-${String(index)}`,
      createdAt: '2026-01-01T00:00:00.000Z',
      product: entry,
    })),
  };
}
