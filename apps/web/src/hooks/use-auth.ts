import type { AuthSessionDto } from '@ecommerce/types';
import type { LoginInput, RegisterInput } from '@ecommerce/validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query';
import { authApi } from '@/services/auth.api';
import { cartApi } from '@/services/shopping.api';
import { hasSessionHint, useAuthStore } from '@/stores/auth.store';
import { useGuestCartStore } from '@/stores/guest-cart.store';

let bootstrap: Promise<void> | null = null;

/** Restores the session from the refresh cookie once per page load. */
export function restoreSession(): Promise<void> {
  if (!hasSessionHint()) {
    useAuthStore.getState().clear();
    return Promise.resolve();
  }

  bootstrap ??= authApi
    .refresh()
    .then((session) => {
      useAuthStore.getState().setSession(session);
    })
    .catch(() => {
      useAuthStore.getState().clear();
    });
  return bootstrap;
}

/** Test hook: lets each test start from a fresh bootstrap. */
export function resetSessionBootstrap(): void {
  bootstrap = null;
}

/** Moves the signed-out cart into the account after sign-in. */
async function mergeGuestCart(): Promise<void> {
  const { items, clear } = useGuestCartStore.getState();
  if (items.length === 0) {
    return;
  }

  await cartApi.merge({
    items: items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    })),
  });
  clear();
}

function useSessionMutation<TInput>(action: (input: TInput) => Promise<AuthSessionDto>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TInput) => {
      const session = await action(input);
      useAuthStore.getState().setSession(session);
      try {
        await mergeGuestCart();
      } catch {
        // The account is signed in either way; the guest cart stays local for another try.
      }
      return session;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      await queryClient.invalidateQueries({ queryKey: queryKeys.wishlist });
    },
  });
}

export function useLogin() {
  return useSessionMutation((input: LoginInput) => authApi.login(input));
}

export function useRegister() {
  return useSessionMutation((input: RegisterInput) => authApi.register(input));
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        await authApi.logout();
      } finally {
        useAuthStore.getState().clear();
        queryClient.removeQueries({ queryKey: queryKeys.cart });
        queryClient.removeQueries({ queryKey: queryKeys.wishlist });
        queryClient.removeQueries({ queryKey: queryKeys.addresses });
        queryClient.removeQueries({ queryKey: ['orders'] });
        queryClient.removeQueries({ queryKey: ['order'] });
      }
    },
  });
}
