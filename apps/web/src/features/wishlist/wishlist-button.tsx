import { Heart } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { useWishlist } from '@/hooks/use-wishlist';
import { errorMessage } from '@/lib/query';
import { cn } from '@/lib/utils';

const PARTICLES = Array.from({ length: 8 }, (_, index) => (index / 8) * Math.PI * 2);

export function WishlistButton({
  productId,
  productName,
  className,
  size = 'md',
}: {
  productId: string;
  productName: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const wishlist = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();
  const saved = wishlist.has(productId);
  const [burst, setBurst] = useState(0);

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.8 }}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`}
      className={cn(
        'glass relative grid shrink-0 place-items-center rounded-full text-fg shadow-sm transition-colors hover:text-sale',
        size === 'sm' ? 'size-9' : 'size-11',
        className,
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!saved) {
          setBurst((value) => value + 1);
        }
        wishlist
          .toggle(productId)
          .then((done) => {
            if (!done) {
              toast('Sign in to save favourites', {
                action: {
                  label: 'Sign in',
                  onClick: () => {
                    void navigate('/login', { state: { from: location.pathname } });
                  },
                },
              });
            } else if (!saved) {
              toast.success('Saved to your wishlist');
            }
          })
          .catch((error: unknown) => {
            toast.error(errorMessage(error));
          });
      }}
    >
      <motion.span
        key={saved ? 'on' : 'off'}
        initial={{ scale: saved ? 0.4 : 1 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 12 }}
      >
        <Heart
          className={cn(size === 'sm' ? 'size-4' : 'size-[18px]', saved && 'text-sale')}
          fill={saved ? 'currentColor' : 'none'}
        />
      </motion.span>
      <AnimatePresence>
        {burst > 0 && (
          <motion.span key={burst} className="pointer-events-none absolute inset-0" aria-hidden>
            {PARTICLES.map((angle) => (
              <motion.span
                key={angle}
                className="absolute top-1/2 left-1/2 size-1.5 rounded-full bg-sale"
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(angle) * 22,
                  y: Math.sin(angle) * 22,
                  opacity: 0,
                  scale: 0.3,
                }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            ))}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
