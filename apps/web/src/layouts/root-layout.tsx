import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import { type ReactNode, useState } from 'react';
import { type Location, Navigate, ScrollRestoration, useLocation, useOutlet } from 'react-router';

import { Skeleton } from '@/components/ui/display';
import { CartDrawer } from '@/features/cart/cart-drawer';
import { FlyToCart } from '@/features/cart/fly-to-cart';
import { OfflineBanner } from '@/features/pwa/pwa-parts';
import { CommandPalette } from '@/features/search/command-palette';
import { useAuthStore } from '@/stores/auth.store';

import { Footer } from './footer';
import { Header } from './header';

/**
 * Every full page load starts with location.key "default", so keying scroll positions by key alone
 * would restore one page's position on another. Fall back to the URL for those entries.
 */
function scrollKey(location: Location): string {
  return location.key === 'default' ? `${location.pathname}${location.search}` : location.key;
}

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

  return (
    <motion.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-[oklch(70%_0.16_285)] via-accent to-[oklch(62%_0.2_330)]"
      style={{ scaleX }}
    />
  );
}

/** Keeps the outgoing page's content mounted while its exit animation plays. */
function Frozen({ children }: { children: ReactNode }) {
  const [frozen] = useState(children);
  return frozen;
}

function AnimatedOutlet() {
  const location = useLocation();
  const outlet = useOutlet();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.main
        key={location.pathname}
        id="main"
        initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="min-h-[60vh]"
      >
        <Frozen>{outlet}</Frozen>
      </motion.main>
    </AnimatePresence>
  );
}

export function RootLayout() {
  return (
    <>
      <a
        href="#main"
        className="sr-only z-[70] rounded-full bg-fg px-4 py-2 text-bg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <ScrollProgress />
      <Header />
      <AnimatedOutlet />
      <Footer />
      <CartDrawer />
      <CommandPalette />
      <FlyToCart />
      <OfflineBanner />
      <ScrollRestoration getKey={scrollKey} />
    </>
  );
}

export function PageFallback() {
  return (
    <div className="container-page space-y-6 py-16">
      <Skeleton className="h-12 w-1/3" />
      <Skeleton className="h-5 w-1/2" />
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="aspect-[4/5]" />
        ))}
      </div>
    </div>
  );
}

/** Sends signed-out visitors to sign in, remembering where they were going. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === 'unknown') {
    return <PageFallback />;
  }
  if (status === 'anonymous') {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }

  return children;
}

/** Keeps signed-in customers away from the sign-in and registration pages. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();
  const state: unknown = location.state;
  const from =
    typeof state === 'object' && state !== null && 'from' in state && typeof state.from === 'string'
      ? state.from
      : '/account';

  if (status === 'authenticated') {
    return <Navigate to={from} replace />;
  }

  return children;
}
