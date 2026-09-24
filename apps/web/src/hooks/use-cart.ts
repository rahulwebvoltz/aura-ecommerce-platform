import { freeShippingRemaining } from '@ecommerce/shared';
import type { CartDto, CartItemDto } from '@ecommerce/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query';
import { cartApi } from '@/services/shopping.api';
import { useAuthStore } from '@/stores/auth.store';
import {
  type GuestCartItem,
  type GuestCartProduct,
  useGuestCartStore,
} from '@/stores/guest-cart.store';

/** One shape for guest and account carts so components never branch on auth state. */
export interface CartLine {
  id: string;
  productId: string;
  variantId: string | null;
  name: string;
  slug: string;
  image: string | null;
  brand: string | null;
  attributes: Record<string, string> | null;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  lineTotal: number;
  availableStock: number;
  priceChanged: boolean;
}

export interface AddToCartInput {
  productId: string;
  variantId: string | null;
  quantity: number;
  snapshot: GuestCartProduct;
}

export function fromServerItem(item: CartItemDto): CartLine {
  return {
    id: item.id,
    productId: item.product.id,
    variantId: item.variant?.id ?? null,
    name: item.product.name,
    slug: item.product.slug,
    image: item.product.image?.url ?? null,
    brand: item.product.brand,
    attributes: item.variant?.attributes ?? null,
    unitPrice: item.unitPrice,
    compareAtPrice: item.compareAtPrice,
    quantity: item.quantity,
    lineTotal: item.lineTotal,
    availableStock: item.availableStock,
    priceChanged: item.priceChanged,
  };
}

export function fromGuestItem(item: GuestCartItem): CartLine {
  return {
    id: item.key,
    productId: item.productId,
    variantId: item.variantId,
    name: item.product.name,
    slug: item.product.slug,
    image: item.product.image,
    brand: item.product.brand,
    attributes: item.product.attributes,
    unitPrice: item.product.price,
    compareAtPrice: item.product.compareAtPrice,
    quantity: item.quantity,
    lineTotal: item.product.price * item.quantity,
    availableStock: item.product.stock,
    priceChanged: false,
  };
}

/** Applies a change to cached cart lines before the server confirms it. */
function patchCart(cart: CartDto, itemId: string, quantity: number | null): CartDto {
  const items = cart.items.flatMap((item) => {
    if (item.id !== itemId) {
      return [item];
    }
    return quantity === null ? [] : [{ ...item, quantity, lineTotal: item.unitPrice * quantity }];
  });
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  return {
    ...cart,
    items,
    summary: {
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      freeShippingRemaining: freeShippingRemaining(subtotal),
    },
  };
}

export function useCart() {
  const authenticated = useAuthStore((state) => state.status === 'authenticated');
  const guestItems = useGuestCartStore((state) => state.items);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.cart,
    queryFn: cartApi.get,
    enabled: authenticated,
  });

  const store = (cart: CartDto) => {
    queryClient.setQueryData(queryKeys.cart, cart);
  };

  const optimistic = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number | null }) =>
      quantity === null ? cartApi.remove(itemId) : cartApi.update(itemId, quantity),
    onMutate: async ({ itemId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.cart });
      const previous = queryClient.getQueryData<CartDto>(queryKeys.cart);
      if (previous !== undefined) {
        store(patchCart(previous, itemId, quantity));
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous !== undefined) {
        store(context.previous);
      }
    },
    onSuccess: store,
  });

  const addMutation = useMutation({
    mutationFn: (input: AddToCartInput) =>
      cartApi.add({
        productId: input.productId,
        variantId: input.variantId,
        quantity: input.quantity,
      }),
    onSuccess: store,
  });

  const clearMutation = useMutation({ mutationFn: cartApi.clear, onSuccess: store });

  const lines = authenticated
    ? (query.data?.items.map(fromServerItem) ?? [])
    : guestItems.map(fromGuestItem);
  const subtotal = authenticated
    ? (query.data?.summary.subtotal ?? 0)
    : lines.reduce((sum, line) => sum + line.lineTotal, 0);

  return {
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal,
    freeShippingRemaining: freeShippingRemaining(subtotal),
    isLoading: authenticated && query.isPending,
    isAdding: addMutation.isPending,

    async add(input: AddToCartInput): Promise<void> {
      if (!authenticated) {
        useGuestCartStore.getState().add({
          productId: input.productId,
          variantId: input.variantId,
          quantity: input.quantity,
          product: input.snapshot,
        });
        return;
      }
      await addMutation.mutateAsync(input);
    },

    async updateQuantity(lineId: string, quantity: number): Promise<void> {
      if (!authenticated) {
        useGuestCartStore.getState().setQuantity(lineId, quantity);
        return;
      }
      await optimistic.mutateAsync({ itemId: lineId, quantity });
    },

    async remove(lineId: string): Promise<void> {
      if (!authenticated) {
        useGuestCartStore.getState().remove(lineId);
        return;
      }
      await optimistic.mutateAsync({ itemId: lineId, quantity: null });
    },

    async clear(): Promise<void> {
      if (!authenticated) {
        useGuestCartStore.getState().clear();
        return;
      }
      await clearMutation.mutateAsync();
    },
  };
}

export type CartApi = ReturnType<typeof useCart>;
