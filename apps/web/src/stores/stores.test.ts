import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { session, user } from '@/test/utils';

import { hasSessionHint, useAuthStore } from './auth.store';
import { guestCartKey, useGuestCartStore } from './guest-cart.store';
import { useUiStore } from './ui.store';

const snapshot = {
  name: 'Phone',
  slug: 'phone',
  image: null,
  brand: 'Acme',
  price: 10_000,
  compareAtPrice: null,
  stock: 4,
  attributes: null,
};

beforeEach(() => {
  useGuestCartStore.setState({ items: [] });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('auth store', () => {
  it('tracks the session and a credential-free session hint', () => {
    expect(hasSessionHint()).toBe(false);

    useAuthStore.getState().setSession(session);
    expect(useAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      accessToken: 'token-1',
    });
    expect(hasSessionHint()).toBe(true);
    expect(localStorage.getItem('aura-session')).toBe('1');

    useAuthStore.getState().setUser({ ...user, firstName: 'Renamed' });
    expect(useAuthStore.getState().user?.firstName).toBe('Renamed');

    useAuthStore.getState().clear();
    expect(useAuthStore.getState()).toMatchObject({ status: 'anonymous', user: null });
    expect(hasSessionHint()).toBe(false);
  });

  it('keeps working when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(hasSessionHint()).toBe(true);
    expect(() => {
      useAuthStore.getState().setSession(session);
      useAuthStore.getState().clear();
    }).not.toThrow();
  });
});

describe('guest cart store', () => {
  it('adds, merges, clamps, and removes lines', () => {
    const { add } = useGuestCartStore.getState();
    add({ productId: 'p1', variantId: null, quantity: 2, product: snapshot });
    const merged = add({ productId: 'p1', variantId: null, quantity: 5, product: snapshot });
    add({ productId: 'p1', variantId: 'v1', quantity: 1, product: snapshot });

    expect(merged.quantity).toBe(4);
    expect(useGuestCartStore.getState().items.map((item) => [item.key, item.quantity])).toEqual([
      ['p1:base', 4],
      ['p1:v1', 1],
    ]);

    useGuestCartStore.getState().setQuantity('p1:base', 0);
    useGuestCartStore.getState().setQuantity('missing', 3);
    expect(useGuestCartStore.getState().items[0]?.quantity).toBe(1);

    useGuestCartStore.getState().remove('p1:v1');
    expect(useGuestCartStore.getState().items).toHaveLength(1);
    useGuestCartStore.getState().clear();
    expect(useGuestCartStore.getState().items).toEqual([]);
  });

  it('caps quantities at the per-item limit and persists to storage', () => {
    useGuestCartStore
      .getState()
      .add({ productId: 'p2', variantId: null, quantity: 25, product: { ...snapshot, stock: 99 } });

    expect(useGuestCartStore.getState().items[0]?.quantity).toBe(10);
    expect(localStorage.getItem('aura-guest-cart')).toContain('p2');
    expect(guestCartKey('p', 'v')).toBe('p:v');
  });
});

describe('ui store', () => {
  it('toggles overlays', () => {
    const { setCartOpen, setSearchOpen, setMenuOpen } = useUiStore.getState();
    setCartOpen(true);
    setSearchOpen(true);
    setMenuOpen(true);
    expect(useUiStore.getState()).toMatchObject({
      cartOpen: true,
      searchOpen: true,
      menuOpen: true,
    });
  });

  it('launches flights from an element and pulses the cart when they land', () => {
    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 10, y: 20, width: 100, height: 50 }),
    );

    useUiStore.getState().launchFlight('https://img.example.test/p.png', element);
    const [flight] = useUiStore.getState().flights;
    expect(flight?.from).toEqual({ x: 10, y: 20, width: 100, height: 50 });

    const pulse = useUiStore.getState().cartPulse;
    useUiStore.getState().landFlight(flight?.id ?? 0);
    expect(useUiStore.getState().flights).toEqual([]);
    expect(useUiStore.getState().cartPulse).toBe(pulse + 1);
  });
});

describe('theme store', () => {
  async function loadTheme() {
    vi.resetModules();
    return (await import('./theme.store')).useThemeStore;
  }

  it('starts from the saved theme and persists toggles', async () => {
    localStorage.setItem('aura-theme', 'dark');
    const store = await loadTheme();
    expect(store.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    store.getState().toggle();
    expect(store.getState().theme).toBe('light');
    expect(localStorage.getItem('aura-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    store.getState().toggle();
    expect(store.getState().theme).toBe('dark');
  });

  it('falls back to the system preference and tolerates blocked storage', async () => {
    const store = await loadTheme();
    expect(store.getState().theme).toBe('light');

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const blocked = await loadTheme();
    expect(() => {
      blocked.getState().toggle();
    }).not.toThrow();
    expect(blocked.getState().theme).toBe('dark');
  });
});
