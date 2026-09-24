import type { ComponentType } from 'react';
import { createBrowserRouter } from 'react-router';

import { GuestOnly, PageFallback, RequireAuth, RootLayout } from '@/layouts/root-layout';
import { ErrorPage, NotFoundPage } from '@/pages/error-page';

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

export const router = createBrowserRouter([
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
        lazy: page(
          () => import('@/pages/products-page'),
          (m) => m.ProductsPage,
        ),
      },
      {
        path: 'search',
        lazy: page(
          () => import('@/pages/products-page'),
          (m) => m.ProductsPage,
        ),
      },
      {
        path: 'category/:slug',
        lazy: page(
          () => import('@/pages/products-page'),
          (m) => m.ProductsPage,
        ),
      },
      {
        path: 'products/:slug',
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
