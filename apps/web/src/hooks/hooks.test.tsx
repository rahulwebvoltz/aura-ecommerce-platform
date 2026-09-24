import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query';
import { useAuthStore } from '@/stores/auth.store';
import { useGuestCartStore } from '@/stores/guest-cart.store';
import {
  cart,
  cartItem,
  createTestQueryClient,
  fail,
  mockFetch,
  ok,
  product,
  session,
  wishlist,
  wrapperFor,
} from '@/test/utils';

import {
  resetSessionBootstrap,
  restoreSession,
  useLogin,
  useLogout,
  useRegister,
} from './use-auth';
import { fromGuestItem, fromServerItem, useCart } from './use-cart';
import {
  useCommandShortcut,
  useDebouncedValue,
  useDocumentTitle,
  useOnline,
  useScrolled,
} from './use-utils';
import { useWishlist } from './use-wishlist';

const snapshot = {
  name: 'Phone',
  slug: 'phone',
  image: null,
  brand: 'Acme',
  price: 10_000,
  compareAtPrice: null,
  stock: 5,
  attributes: null,
};

function signIn(): void {
  useAuthStore.setState({ status: 'authenticated', user: session.user, accessToken: 'token-1' });
}

beforeEach(() => {
  useAuthStore.setState({ status: 'unknown', user: null, accessToken: null });
  useGuestCartStore.setState({ items: [] });
  resetSessionBootstrap();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('utility hooks', () => {
  it('debounces values', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'a' },
    });
    rerender({ value: 'ab' });
    expect(result.current).toBe('a');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('ab');
  });

  it('sets the document title', () => {
    const initialProps: { title: string | undefined } = { title: 'Cart' };
    const { rerender } = renderHook(
      ({ title }: { title: string | undefined }) => {
        useDocumentTitle(title);
      },
      { initialProps },
    );
    expect(document.title).toBe('Cart · Aura');
    rerender({ title: undefined });
    expect(document.title).toBe('Aura - Curated goods');
  });

  it('tracks scrolling past an offset', () => {
    const { result, unmount } = renderHook(() => useScrolled(10));
    expect(result.current).toBe(false);
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 50, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current).toBe(true);
    unmount();
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('runs the ⌘K / Ctrl+K handler only for that shortcut', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => {
      useCommandShortcut(handler);
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'K', metaKey: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true }));
    expect(handler).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('follows the browser going offline and back online', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const { result, unmount } = renderHook(() => useOnline());
    expect(result.current).toBe(true);

    act(() => {
      onLine.mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);

    act(() => {
      onLine.mockReturnValue(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
    unmount();
  });
});

describe('session hooks', () => {
  it('skips the refresh for browsers that never signed in', async () => {
    const { fetchMock } = mockFetch(() => ok(session));
    await restoreSession();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('anonymous');
  });

  it('restores a session once, or signs out when the cookie is gone', async () => {
    localStorage.setItem('aura-session', '1');
    const { fetchMock } = mockFetch(() => ok(session));
    await Promise.all([restoreSession(), restoreSession()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().status).toBe('authenticated');

    resetSessionBootstrap();
    mockFetch(() => fail(401, 'SESSION_EXPIRED', 'Expired'));
    await restoreSession();
    expect(useAuthStore.getState().status).toBe('anonymous');
  });

  it('merges the guest cart after signing in', async () => {
    useGuestCartStore
      .getState()
      .add({ productId: 'p1', variantId: null, quantity: 2, product: snapshot });
    const { calls } = mockFetch((call) =>
      call.url.endsWith('/cart/merge') ? ok(cart([])) : ok(session),
    );
    const client = createTestQueryClient();
    const { result } = renderHook(() => useLogin(), { wrapper: wrapperFor(client) });

    await act(() => result.current.mutateAsync({ email: 'asha@example.com', password: 'x' }));

    expect(calls[1]?.body).toEqual({ items: [{ productId: 'p1', variantId: null, quantity: 2 }] });
    expect(useGuestCartStore.getState().items).toEqual([]);
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('keeps the guest cart when the merge fails and still signs in', async () => {
    useGuestCartStore
      .getState()
      .add({ productId: 'p1', variantId: null, quantity: 1, product: snapshot });
    mockFetch((call) =>
      call.url.endsWith('/cart/merge') ? fail(500, 'DOWN', 'Down') : ok(session),
    );
    const client = createTestQueryClient();
    const { result } = renderHook(() => useRegister(), { wrapper: wrapperFor(client) });

    await act(() =>
      result.current.mutateAsync({
        email: 'a@example.com',
        password: 'Secret123',
        firstName: 'A',
        lastName: 'B',
      }),
    );

    expect(useGuestCartStore.getState().items).toHaveLength(1);
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('clears local state on logout even if the request fails', async () => {
    signIn();
    mockFetch(() => fail(500, 'DOWN', 'Down'));
    const client = createTestQueryClient();
    client.setQueryData(queryKeys.cart, cart([cartItem()]));
    const { result } = renderHook(() => useLogout(), { wrapper: wrapperFor(client) });

    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });

    expect(useAuthStore.getState().status).toBe('anonymous');
    expect(client.getQueryData(queryKeys.cart)).toBeUndefined();
  });
});

describe('useCart', () => {
  it('maps guest and server lines to one shape', () => {
    const guest = useGuestCartStore.getState().add({
      productId: 'p1',
      variantId: 'v1',
      quantity: 2,
      product: { ...snapshot, attributes: { size: 'M' } },
    });
    expect(fromGuestItem(guest)).toMatchObject({
      id: 'p1:v1',
      lineTotal: 20_000,
      attributes: { size: 'M' },
    });
    expect(
      fromServerItem(
        cartItem({
          variant: { id: 'v1', sku: 'S', attributes: { size: 'L' } },
          product: {
            id: 'p1',
            name: 'Phone',
            slug: 'phone',
            image: { id: 'i', url: 'u', alt: null, sortOrder: 0 },
            brand: null,
          },
        }),
      ),
    ).toMatchObject({ variantId: 'v1', image: 'u', attributes: { size: 'L' } });
    expect(fromServerItem(cartItem())).toMatchObject({
      variantId: null,
      image: null,
      attributes: null,
    });
  });

  it('keeps a local cart for guests', async () => {
    useAuthStore.setState({ status: 'anonymous' });
    const client = createTestQueryClient();
    const { result } = renderHook(() => useCart(), { wrapper: wrapperFor(client) });

    await act(() =>
      result.current.add({ productId: 'p1', variantId: null, quantity: 2, snapshot }),
    );
    expect(result.current).toMatchObject({ itemCount: 2, subtotal: 20_000, isLoading: false });

    await act(() => result.current.updateQuantity('p1:base', 3));
    expect(result.current.itemCount).toBe(3);
    await act(() => result.current.remove('p1:base'));
    expect(result.current.lines).toEqual([]);

    await act(() =>
      result.current.add({ productId: 'p1', variantId: null, quantity: 1, snapshot }),
    );
    await act(() => result.current.clear());
    expect(result.current.itemCount).toBe(0);
  });

  it('uses the account cart with optimistic updates and rollback', async () => {
    signIn();
    let failNext = false;
    const { calls } = mockFetch((call) => {
      if (failNext) {
        failNext = false;
        return fail(409, 'INSUFFICIENT_STOCK', 'Only 2 left.');
      }
      if (call.method === 'GET') return ok(cart([cartItem()]));
      if (call.method === 'POST') return ok(cart([cartItem({ quantity: 2, lineTotal: 20_000 })]));
      if (call.method === 'PATCH') return ok(cart([cartItem({ quantity: 3, lineTotal: 30_000 })]));
      return ok(cart([]));
    });
    const client = createTestQueryClient();
    const { result } = renderHook(() => useCart(), { wrapper: wrapperFor(client) });

    await waitFor(() => {
      expect(result.current.itemCount).toBe(1);
    });

    await act(() =>
      result.current.add({ productId: 'p1', variantId: null, quantity: 1, snapshot }),
    );
    await waitFor(() => {
      expect(result.current.itemCount).toBe(2);
    });

    await act(() => result.current.updateQuantity('line-1', 3));
    await waitFor(() => {
      expect(result.current.subtotal).toBe(30_000);
    });

    failNext = true;
    await act(async () => {
      await result.current.updateQuantity('line-1', 9).catch(() => undefined);
    });
    await waitFor(() => {
      expect(result.current.itemCount).toBe(3);
    });

    await act(() => result.current.remove('line-1'));
    await waitFor(() => {
      expect(result.current.lines).toEqual([]);
    });

    await act(() => result.current.clear());
    expect(calls.at(-1)?.method).toBe('DELETE');
  });

  it('skips optimistic patches when nothing is cached yet', async () => {
    signIn();
    mockFetch((call) =>
      call.method === 'GET' ? new Promise<Response>(() => undefined) : ok(cart([])),
    );
    const client = createTestQueryClient();
    const { result } = renderHook(() => useCart(), { wrapper: wrapperFor(client) });

    expect(result.current.isLoading).toBe(true);
    await act(() => result.current.remove('line-1'));
    expect(result.current.lines).toEqual([]);
  });
});

describe('useWishlist', () => {
  it('asks guests to sign in', async () => {
    useAuthStore.setState({ status: 'anonymous' });
    const client = createTestQueryClient();
    const { result } = renderHook(() => useWishlist(), { wrapper: wrapperFor(client) });

    await expect(result.current.toggle('p1')).resolves.toBe(false);
    expect(result.current.items).toEqual([]);
  });

  it('saves and removes products, rolling back on failure', async () => {
    signIn();
    let failNext = false;
    mockFetch((call) => {
      if (failNext) {
        failNext = false;
        return fail(500, 'DOWN', 'Down');
      }
      if (call.method === 'POST') return ok(wishlist([product]));
      if (call.method === 'DELETE') return ok(wishlist([]));
      return ok(wishlist([]));
    });
    const client = createTestQueryClient();
    const { result } = renderHook(() => useWishlist(), { wrapper: wrapperFor(client) });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.toggle('p1')).resolves.toBe(true);
    });
    await waitFor(() => {
      expect(result.current.has('p1')).toBe(true);
    });

    failNext = true;
    await act(async () => {
      await result.current.toggle('p1').catch(() => undefined);
    });
    await waitFor(() => {
      expect(result.current.has('p1')).toBe(true);
    });

    await act(() => result.current.toggle('p1'));
    await waitFor(() => {
      expect(result.current.has('p1')).toBe(false);
    });
  });

  it('toggles without an optimistic patch before the list loads', async () => {
    signIn();
    mockFetch((call) =>
      call.method === 'GET' ? new Promise<Response>(() => undefined) : ok(wishlist([product])),
    );
    const client = createTestQueryClient();
    const { result } = renderHook(() => useWishlist(), { wrapper: wrapperFor(client) });

    await act(() => result.current.toggle('p1'));
    await waitFor(() => {
      expect(result.current.has('p1')).toBe(true);
    });
  });
});
