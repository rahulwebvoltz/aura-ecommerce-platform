import { discountPercent } from '@ecommerce/shared';
import type { ProductSummaryDto } from '@ecommerce/types';
import { Plus, ShoppingBag } from 'lucide-react';
import { motion } from 'motion/react';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { Badge, Price, Rating, Skeleton } from '@/components/ui/display';
import { WishlistButton } from '@/features/wishlist/wishlist-button';
import { useCart } from '@/hooks/use-cart';
import { errorMessage } from '@/lib/query';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/ui.store';

export function ProductCard({
  product,
  index = 0,
  className,
}: {
  product: ProductSummaryDto;
  index?: number;
  className?: string;
}) {
  const cart = useCart();
  const navigate = useNavigate();
  const launchFlight = useUiStore((state) => state.launchFlight);
  const imageRef = useRef<HTMLDivElement>(null);
  const [adding, setAdding] = useState(false);
  const off = discountPercent(product.price, product.compareAtPrice);
  const soldOut = product.stock === 0;
  const lowStock = !soldOut && product.stock <= 5;
  const detailPath = `/products/${product.slug}`;

  const quickAdd = async () => {
    if (product.hasVariants) {
      void navigate(detailPath);
      return;
    }
    setAdding(true);
    try {
      await cart.add({
        productId: product.id,
        variantId: null,
        quantity: 1,
        snapshot: {
          name: product.name,
          slug: product.slug,
          image: product.image?.url ?? null,
          brand: product.brand?.name ?? null,
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          stock: product.stock,
          attributes: null,
        },
      });
      if (imageRef.current !== null && product.image !== null) {
        launchFlight(product.image.url, imageRef.current);
      }
      toast.success(`${product.name} added to your bag`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAdding(false);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, delay: (index % 4) * 0.07, ease: [0.16, 1, 0.3, 1] }}
      className={cn('group relative flex flex-col', className)}
    >
      <div className="relative">
        <Link to={detailPath} className="block" aria-label={product.name}>
          <div
            ref={imageRef}
            className="relative aspect-[4/5] overflow-hidden rounded-[26px] bg-surface-2"
          >
            {product.image !== null && (
              <motion.img
                src={product.image.url}
                alt={product.image.alt ?? product.name}
                loading="lazy"
                decoding="async"
                className={cn(
                  'absolute inset-0 size-full object-contain p-6 mix-blend-multiply transition duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.06] dark:mix-blend-normal',
                  product.hoverImage !== null && 'group-hover:opacity-0',
                  soldOut && 'opacity-60 grayscale',
                )}
              />
            )}
            {product.hoverImage !== null && (
              <img
                src={product.hoverImage.url}
                alt=""
                aria-hidden
                loading="lazy"
                className="absolute inset-0 size-full scale-[1.06] object-contain p-6 opacity-0 mix-blend-multiply transition duration-700 ease-[var(--ease-out-expo)] group-hover:scale-100 group-hover:opacity-100 dark:mix-blend-normal"
              />
            )}

            <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
              {off >= 5 && <Badge tone="sale">−{off}%</Badge>}
              {soldOut && <Badge tone="dark">Sold out</Badge>}
              {lowStock && <Badge tone="warning">Only {product.stock} left</Badge>}
            </div>
          </div>
        </Link>

        <WishlistButton
          productId={product.id}
          productName={product.name}
          size="sm"
          className="absolute top-3 right-3"
        />

        {!soldOut && (
          <motion.button
            type="button"
            onClick={() => {
              void quickAdd();
            }}
            disabled={adding}
            whileTap={{ scale: 0.95 }}
            className="absolute inset-x-3 bottom-3 flex h-11 translate-y-3 items-center justify-center gap-2 rounded-full bg-fg text-sm font-medium text-bg opacity-0 shadow-lg transition-all duration-300 ease-[var(--ease-out-expo)] group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 max-md:hidden"
            aria-label={
              product.hasVariants
                ? `Choose options for ${product.name}`
                : `Add ${product.name} to bag`
            }
          >
            {product.hasVariants ? (
              <>
                <Plus className="size-4" /> Choose options
              </>
            ) : (
              <>
                <ShoppingBag className="size-4" /> {adding ? 'Adding…' : 'Quick add'}
              </>
            )}
          </motion.button>
        )}
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-1.5 px-1">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow truncate">{product.brand?.name ?? product.category.name}</span>
          {product.ratingCount > 0 && <Rating value={product.ratingAverage} size={12} />}
        </div>
        <Link
          to={detailPath}
          className="line-clamp-2 text-[15px] leading-snug font-medium text-fg decoration-accent/50 underline-offset-4 hover:underline"
        >
          {product.name}
        </Link>
        <Price
          price={product.price}
          compareAtPrice={product.compareAtPrice}
          className="mt-auto pt-1"
        />
      </div>
    </motion.article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="aspect-[4/5] rounded-[26px]" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-1/4" />
    </div>
  );
}

export function ProductGrid({
  products,
  loading = false,
  skeletons = 8,
}: {
  products: ProductSummaryDto[];
  loading?: boolean;
  skeletons?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
      {loading
        ? Array.from({ length: skeletons }, (_, index) => <ProductCardSkeleton key={index} />)
        : products.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} />
          ))}
    </div>
  );
}
