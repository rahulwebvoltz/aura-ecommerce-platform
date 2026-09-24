import { calculateOrderTotals, formatMoney } from '@ecommerce/shared';
import { ArrowRight, Lock, ShoppingBag } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Link, useNavigate } from 'react-router';

import { Button, Magnetic } from '@/components/ui/button';
import { AnimatedNumber, EmptyState, Skeleton } from '@/components/ui/display';
import { CartLineItem, FreeShippingBar } from '@/features/cart/cart-parts';
import { useCart } from '@/hooks/use-cart';
import { useDocumentTitle } from '@/hooks/use-utils';
import { pluralize } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

export function CartPage() {
  useDocumentTitle('Your bag');
  const cart = useCart();
  const navigate = useNavigate();
  const authenticated = useAuthStore((state) => state.status === 'authenticated');
  // An estimate for display only; checkout recalculates everything on the server.
  const estimate = calculateOrderTotals({
    subtotal: cart.subtotal,
    discount: 0,
    itemCount: cart.lines.length,
  });

  if (cart.isLoading) {
    return (
      <div className="container-page space-y-4 py-16">
        <Skeleton className="h-14 w-60" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={<ShoppingBag className="size-7" />}
          title="Your bag is empty"
          description="Discover something you’ll love - it’ll be waiting right here."
          action={
            <Link to="/products">
              <Button>Start shopping</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="container-page py-12">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-display mb-10 flex items-baseline gap-4 text-[clamp(2.8rem,6vw,5rem)]"
      >
        Your bag{' '}
        <span className="font-sans text-base text-muted">{pluralize(cart.itemCount, 'item')}</span>
      </motion.h1>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <FreeShippingBar remaining={cart.freeShippingRemaining} />
          <ul className="space-y-5">
            <AnimatePresence initial={false}>
              {cart.lines.map((line) => (
                <CartLineItem
                  key={line.id}
                  line={line}
                  onQuantity={(quantity) => cart.updateQuantity(line.id, quantity)}
                  onRemove={() => cart.remove(line.id)}
                />
              ))}
            </AnimatePresence>
          </ul>
          <button
            type="button"
            onClick={() => {
              void cart.clear();
            }}
            className="text-sm text-muted underline-offset-4 hover:text-sale hover:underline"
          >
            Clear bag
          </button>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-5 rounded-[28px] border border-border bg-surface p-7 card-shadow">
            <h2 className="text-display text-3xl">Summary</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="font-medium tabular-nums">
                  <AnimatedNumber value={estimate.subtotal} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Shipping</dt>
                <dd className="font-medium">
                  {estimate.shipping === 0 ? 'Free' : formatMoney(estimate.shipping)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Estimated GST (18%)</dt>
                <dd className="font-medium tabular-nums">
                  <AnimatedNumber value={estimate.tax} />
                </dd>
              </div>
              <div className="flex items-end justify-between border-t border-border pt-4">
                <dt className="font-medium">Estimated total</dt>
                <dd className="text-2xl font-semibold tabular-nums">
                  <AnimatedNumber value={estimate.total} />
                </dd>
              </div>
            </dl>
            <p className="text-xs text-muted">
              Apply coupons at checkout. Final totals are confirmed securely.
            </p>
            <Magnetic strength={0.12}>
              <Button
                size="lg"
                className="w-full min-w-[320px]"
                onClick={() => {
                  void navigate('/checkout');
                }}
              >
                {authenticated ? 'Checkout' : 'Sign in to checkout'}{' '}
                <ArrowRight className="size-4" />
              </Button>
            </Magnetic>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
              <Lock className="size-3" /> Secure checkout · COD & Razorpay
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
