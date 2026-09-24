import { CART_LIMITS } from '@ecommerce/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Display snapshot so the guest cart renders without refetching every product. */
export interface GuestCartProduct {
  name: string;
  slug: string;
  image: string | null;
  brand: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  attributes: Record<string, string> | null;
}

export interface GuestCartItem {
  key: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  product: GuestCartProduct;
}

interface GuestCartState {
  items: GuestCartItem[];
  add: (input: Omit<GuestCartItem, 'key'>) => GuestCartItem;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

export const guestCartKey = (productId: string, variantId: string | null) =>
  `${productId}:${variantId ?? 'base'}`;

function clampQuantity(quantity: number, stock: number): number {
  return Math.max(1, Math.min(quantity, stock, CART_LIMITS.maxQuantityPerItem));
}

/** Cart for signed-out shoppers, kept in localStorage and merged into the account on sign-in. */
export const useGuestCartStore = create<GuestCartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (input) => {
        const key = guestCartKey(input.productId, input.variantId);
        const existing = get().items.find((item) => item.key === key);
        const quantity = clampQuantity(
          (existing?.quantity ?? 0) + input.quantity,
          input.product.stock,
        );
        const item: GuestCartItem = { ...input, key, quantity };

        set({
          items: existing
            ? get().items.map((entry) => (entry.key === key ? item : entry))
            : [...get().items, item].slice(-CART_LIMITS.maxDistinctItems),
        });
        return item;
      },
      setQuantity: (key, quantity) => {
        set({
          items: get().items.map((item) =>
            item.key === key
              ? { ...item, quantity: clampQuantity(quantity, item.product.stock) }
              : item,
          ),
        });
      },
      remove: (key) => {
        set({ items: get().items.filter((item) => item.key !== key) });
      },
      clear: () => {
        set({ items: [] });
      },
    }),
    {
      name: 'aura-guest-cart',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
