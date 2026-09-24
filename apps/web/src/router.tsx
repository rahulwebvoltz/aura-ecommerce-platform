import type { QueryClient } from '@tanstack/react-query';
import type { ComponentType } from 'react';
import { createBrowserRouter, type LoaderFunctionArgs } from 'react-router';

import { parseProductFilters } from '@/features/catalog/use-product-filters';
import { GuestOnly, PageFallback, RequireAuth, RootLayout } from '@/layouts/root-layout';
import { queryKeys } from '@/lib/query';
import { ErrorPage, NotFoundPage } from '@/pages/error-page';
import { catalogApi } from '@/services/catalog.api';

/** Code-splits a page module; `pick` selects the named component export. */
function page<T extends Record<string, unknown>>(
  load: () => Promise<T>,
  pick: (module: T) => ComponentType,
  guard?: 'auth' | 'guest',
) {
  return async () => {
    const Component = pick(await load());
    if (guard === 'auth') {
      return {
        Component: () => (
          <RequireAuth>
            <Component />
          </RequireAuth>
        ),
      };
    }
    if (guard === 'guest') {
      return {
        Component: () => (
          <GuestOnly>
            <Component />
          </GuestOnly>
        ),
      };
    }
    return { Component };
  };
}

/**
 * Loaders that start a page's main queries while its code chunk is still downloading, instead of
 * after it renders. They never block navigation: pages read the same cache entries with useQuery.
 */
function prefetchers(queryClient: QueryClient) {
  // A failed prefetch is not an error: the page's own query retries and shows the error state.
  const ignore = () => undefined;

  return {
    listing: ({ request, params }: LoaderFunctionArgs) => {
      const filters = parseProductFilters(new URL(request.url).searchParams, params['slug']);
      const facetFilters = { search: filters.search, category: filters.category };
      void queryClient
        .query({
          queryKey: queryKeys.products(filters),
          queryFn: () => catalogApi.products(filters),
        })
        .catch(ignore);
      void queryClient
        .query({
          queryKey: queryKeys.facets(facetFilters),
          queryFn: () => catalogApi.facets(facetFilters),
        })
        .catch(ignore);
      if (filters.category !== undefined) {
        const slug = filters.category;
        void queryClient
          .query({
            queryKey: queryKeys.category(slug),
            queryFn: () => catalogApi.category(slug),
          })
          .catch(ignore);
      }
      return null;
    },
    product: ({ params }: LoaderFunctionArgs) => {
      const slug = params['slug'] ?? '';
      void queryClient
        .query({
          queryKey: queryKeys.product(slug),
          queryFn: () => catalogApi.product(slug),
        })
        .catch(ignore);
      return null;
    },
  };
}

export function createRouter(queryClient: QueryClient) {
  const prefetch = prefetchers(queryClient);

  return createBrowserRouter([
    {
      path: '/',
      Component: RootLayout,
      ErrorBoundary: ErrorPage,
      HydrateFallback: PageFallback,
      children: [
        {
          index: true,
          lazy: page(
            () => import('@/pages/home-page'),
            (m) => m.HomePage,
          ),
        },
        {
          path: 'products',
          loader: prefetch.listing,
          lazy: page(
            () => import('@/pages/products-page'),
            (m) => m.ProductsPage,
          ),
        },
        {
          path: 'search',
          loader: prefetch.listing,
          lazy: page(
            () => import('@/pages/products-page'),
            (m) => m.ProductsPage,
          ),
        },
        {
          path: 'category/:slug',
          loader: prefetch.listing,
          lazy: page(
            () => import('@/pages/products-page'),
            (m) => m.ProductsPage,
          ),
        },
        {
          path: 'products/:slug',
          loader: prefetch.product,
          lazy: page(
            () => import('@/pages/product-page'),
            (m) => m.ProductPage,
          ),
        },
        {
          path: 'cart',
          lazy: page(
            () => import('@/pages/cart-page'),
            (m) => m.CartPage,
          ),
        },
        {
          path: 'checkout',
          lazy: page(
            () => import('@/pages/checkout-page'),
            (m) => m.CheckoutPage,
            'auth',
          ),
        },
        {
          path: 'order-success/:id',
          lazy: page(
            () => import('@/pages/order-success-page'),
            (m) => m.OrderSuccessPage,
            'auth',
          ),
        },
        {
          path: 'orders',
          lazy: page(
            () => import('@/pages/orders-page'),
            (m) => m.OrdersPage,
            'auth',
          ),
        },
        {
          path: 'orders/:id',
          lazy: page(
            () => import('@/pages/order-detail-page'),
            (m) => m.OrderDetailPage,
            'auth',
          ),
        },
        {
          path: 'wishlist',
          lazy: page(
            () => import('@/pages/wishlist-page'),
            (m) => m.WishlistPage,
            'auth',
          ),
        },
        {
          path: 'account',
          lazy: page(
            () => import('@/pages/account-page'),
            (m) => m.ProfilePage,
            'auth',
          ),
        },
        {
          path: 'account/addresses',
          lazy: page(
            () => import('@/pages/account-page'),
            (m) => m.AddressesPage,
            'auth',
          ),
        },
        {
          path: 'account/orders',
          lazy: page(
            () => import('@/pages/orders-page'),
            (m) => m.OrdersPage,
            'auth',
          ),
        },
        {
          path: 'account/orders/:id',
          lazy: page(
            () => import('@/pages/order-detail-page'),
            (m) => m.OrderDetailPage,
            'auth',
          ),
        },
        {
          path: 'account/security',
          lazy: page(
            () => import('@/pages/account-page'),
            (m) => m.SecurityPage,
            'auth',
          ),
        },
        {
          path: 'login',
          lazy: page(
            () => import('@/pages/auth-pages'),
            (m) => m.LoginPage,
            'guest',
          ),
        },
        {
          path: 'register',
          lazy: page(
            () => import('@/pages/auth-pages'),
            (m) => m.RegisterPage,
            'guest',
          ),
        },
        {
          path: 'forgot-password',
          lazy: page(
            () => import('@/pages/auth-pages'),
            (m) => m.ForgotPasswordPage,
          ),
        },
        {
          path: 'reset-password',
          lazy: page(
            () => import('@/pages/auth-pages'),
            (m) => m.ResetPasswordPage,
          ),
        },
        {
          path: 'verify-email',
          lazy: page(
            () => import('@/pages/auth-pages'),
            (m) => m.VerifyEmailPage,
          ),
        },
        { path: '*', Component: NotFoundPage },
      ],
    },
  ]);
}
