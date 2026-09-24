import { Heart } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/display';
import { AccountShell } from '@/features/account/account-shell';
import { ProductCard, ProductCardSkeleton } from '@/features/catalog/product-card';
import { useDocumentTitle } from '@/hooks/use-utils';
import { useWishlist } from '@/hooks/use-wishlist';
import { pluralize } from '@/lib/utils';

export function WishlistPage() {
  useDocumentTitle('Wishlist');
  const wishlist = useWishlist();

  return (
    <AccountShell
      title="Wishlist"
      description={wishlist.isLoading ? undefined : pluralize(wishlist.items.length, 'saved item')}
    >
      {wishlist.isLoading ? (
        <div className="grid grid-cols-2 gap-6 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      ) : wishlist.items.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-7" />}
          title="Nothing saved yet"
          description="Tap the heart on anything you love to keep it here for later."
          action={
            <Link to="/products">
              <Button>Discover products</Button>
            </Link>
          }
        />
      ) : (
        <motion.div layout className="grid grid-cols-2 gap-x-6 gap-y-10 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {wishlist.items.map((item, index) => (
              <motion.div
                key={item.id}
                layout
                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.25 } }}
              >
                <ProductCard product={item.product} index={index} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </AccountShell>
  );
}
