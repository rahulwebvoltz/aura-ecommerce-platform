import { ArrowRight, ShoppingBag } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { AnimatedNumber, EmptyState, Skeleton } from '@/components/ui/display';
import { Drawer } from '@/components/ui/overlay';
import { useCart } from '@/hooks/use-cart';
import { pluralize } from '@/lib/utils';
import { useUiStore } from '@/stores/ui.store';

import { CartLineItem, FreeShippingBar } from './cart-parts';

export function CartDrawer() {
  const open = useUiStore((state) => state.cartOpen);
  const setOpen = useUiStore((state) => state.setCartOpen);
  const cart = useCart();
  const navigate = useNavigate();
  const close = () => {
    setOpen(false);
  };

  const go = (path: string) => {
    close();
    void navigate(path);
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      title={
        <span className="flex items-baseline gap-3">
          Your bag
          <span className="font-sans text-sm text-muted">{pluralize(cart.itemCount, 'item')}</span>
        </span>
      }
      footer={
        cart.lines.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-muted">Subtotal</p>
                <p className="text-xs text-subtle">Shipping & GST calculated at checkout</p>
              </div>
              <AnimatedNumber value={cart.subtotal} className="text-2xl font-semibold" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  go('/cart');
                }}
              >
                View bag
              </Button>
              <Button
                onClick={() => {
                  go('/checkout');
                }}
              >
                Checkout <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      {cart.isLoading ? (
        <div className="space-y-5 py-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex gap-4">
              <Skeleton className="size-24" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      ) : cart.lines.length === 0 ? (
        <div className="py-8">
          <EmptyState
            icon={<ShoppingBag className="size-7" />}
            title="Your bag is empty"
            description="Everything you add will wait for you here."
            action={
              <Button
                onClick={() => {
                  go('/products');
                }}
              >
                Start shopping
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-6 pb-6">
          <FreeShippingBar remaining={cart.freeShippingRemaining} />
          <ul className="space-y-5">
            <AnimatePresence initial={false}>
              {cart.lines.map((line) => (
                <CartLineItem
                  key={line.id}
                  line={line}
                  compact
                  onNavigate={close}
                  onQuantity={(quantity) => cart.updateQuantity(line.id, quantity)}
                  onRemove={() => cart.remove(line.id)}
                />
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </Drawer>
  );
}
