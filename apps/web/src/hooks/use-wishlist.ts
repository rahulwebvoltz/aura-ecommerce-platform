import type { WishlistDto } from '@ecommerce/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { queryKeys } from '@/lib/query';
import { wishlistApi } from '@/services/shopping.api';
import { useAuthStore } from '@/stores/auth.store';

export function useWishlist() {
  const authenticated = useAuthStore((state) => state.status === 'authenticated');
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.wishlist,
    queryFn: wishlistApi.get,
    enabled: authenticated,
  });

  const ids = useMemo(
    () => new Set(query.data?.items.map((item) => item.product.id) ?? []),
    [query.data],
  );

  const mutation = useMutation({
    mutationFn: ({ productId, saved }: { productId: string; saved: boolean }) =>
      saved ? wishlistApi.remove(productId) : wishlistApi.add(productId),
    onMutate: async ({ productId, saved }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.wishlist });
      const previous = queryClient.getQueryData<WishlistDto>(queryKeys.wishlist);
      if (previous !== undefined && saved) {
        queryClient.setQueryData<WishlistDto>(queryKeys.wishlist, {
          ...previous,
          items: previous.items.filter((item) => item.product.id !== productId),
        });
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKeys.wishlist, context.previous);
      }
    },
    onSuccess: (wishlist) => {
      queryClient.setQueryData(queryKeys.wishlist, wishlist);
    },
  });

  return {
    items: query.data?.items ?? [],
    isLoading: authenticated && query.isPending,
    authenticated,
    has: (productId: string) => ids.has(productId),
    /** Returns false when the shopper must sign in first. */
    async toggle(productId: string): Promise<boolean> {
      if (!authenticated) {
        return false;
      }
      await mutation.mutateAsync({ productId, saved: ids.has(productId) });
      return true;
    },
  };
}
