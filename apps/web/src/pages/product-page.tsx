import type { ProductDetailDto } from '@ecommerce/types';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion, useInView } from 'motion/react';
import { type ReactNode, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

import { Button, Magnetic } from '@/components/ui/button';
import { Price, QuantityStepper, Rating, Skeleton } from '@/components/ui/display';
import { ProductRail } from '@/features/home/sections';
import { ProductGallery } from '@/features/product/gallery';
import { ReviewsSection } from '@/features/product/reviews';
import {
  findVariant,
  initialSelection,
  type Selection,
  VariantPicker,
} from '@/features/product/variant-picker';
import { WishlistButton } from '@/features/wishlist/wishlist-button';
import { useCart } from '@/hooks/use-cart';
import { useDocumentTitle } from '@/hooks/use-utils';
import { errorMessage, queryKeys } from '@/lib/query';
import { cn, formatDate } from '@/lib/utils';
import { ApiError } from '@/services/api-client';
import { catalogApi } from '@/services/catalog.api';
import { useUiStore } from '@/stores/ui.store';
import { NotFoundPage } from './error-page';

function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
        }}
        className="flex w-full items-center justify-between py-5 text-left font-medium"
      >
        {title}
        <motion.span animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown className="size-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pb-6 text-sm leading-relaxed text-fg/75">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StockIndicator({ stock }: { stock: number }) {
  const tone = stock === 0 ? 'bg-sale' : stock <= 5 ? 'bg-warning' : 'bg-success';
  const label =
    stock === 0
      ? 'Out of stock'
      : stock <= 5
        ? `Only ${String(stock)} left - order soon`
        : 'In stock, ready to ship';

  return (
    <p className="flex items-center gap-2.5 text-sm" aria-live="polite">
      <span className="relative flex size-2.5">
        {stock > 0 && (
          <span
            className={cn(
              'absolute inline-flex size-full animate-ping rounded-full opacity-60',
              tone,
            )}
          />
        )}
        <span className={cn('relative inline-flex size-2.5 rounded-full', tone)} />
      </span>
      {label}
    </p>
  );
}

function deliveryEstimate(): string {
  const from = new Date(Date.now() + 3 * 86_400_000).toISOString();
  const to = new Date(Date.now() + 5 * 86_400_000).toISOString();
  return `${formatDate(from)} – ${formatDate(to)}`;
}

function ProductView({ product }: { product: ProductDetailDto }) {
  const cart = useCart();
  const navigate = useNavigate();
  const launchFlight = useUiStore((state) => state.launchFlight);
  const setCartOpen = useUiStore((state) => state.setCartOpen);
  const galleryRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const ctaVisible = useInView(ctaRef, { margin: '-80px 0px 0px 0px' });
  const [selection, setSelection] = useState<Selection>(() => initialSelection(product.variants));
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState<'add' | 'buy' | null>(null);
  const related = useQuery({
    queryKey: queryKeys.related(product.slug),
    queryFn: () => catalogApi.related(product.slug),
  });

  const variant = product.hasVariants ? findVariant(product.variants, selection) : undefined;
  const price = variant?.price ?? product.price;
  const compareAtPrice = variant === undefined ? product.compareAtPrice : variant.compareAtPrice;
  const stock = product.hasVariants ? (variant?.stock ?? 0) : product.stock;
  const canBuy = stock > 0 && (!product.hasVariants || variant !== undefined);

  const add = async (mode: 'add' | 'buy') => {
    setPending(mode);
    try {
      await cart.add({
        productId: product.id,
        variantId: variant?.id ?? null,
        quantity,
        snapshot: {
          name: product.name,
          slug: product.slug,
          image: product.images[0]?.url ?? null,
          brand: product.brand?.name ?? null,
          price,
          compareAtPrice,
          stock,
          attributes: variant?.attributes ?? null,
        },
      });
      if (mode === 'buy') {
        void navigate('/checkout');
        return;
      }
      const image = product.images[0];
      if (galleryRef.current !== null && image !== undefined) {
        launchFlight(image.url, galleryRef.current);
      }
      toast.success('Added to your bag', {
        action: {
          label: 'View bag',
          onClick: () => {
            setCartOpen(true);
          },
        },
      });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <div className="container-page pt-6 pb-10">
        <nav
          aria-label="Breadcrumb"
          className="mb-8 flex flex-wrap items-center gap-1.5 text-xs text-muted"
        >
          <Link to="/" className="-mx-1 inline-block px-1 py-2 hover:text-fg">
            Home
          </Link>
          {product.breadcrumbs.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1.5">
              <ChevronRight className="size-3" />
              <Link
                to={`/category/${crumb.slug}`}
                className="-mx-1 inline-block px-1 py-2 hover:text-fg"
              >
                {crumb.name}
              </Link>
            </span>
          ))}
          <ChevronRight className="size-3" />
          <span className="text-fg">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-12 xl:gap-20">
          <div className="md:sticky md:top-24 md:self-start">
            <ProductGallery ref={galleryRef} images={product.images} name={product.name} />
          </div>

          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  {product.brand !== null && (
                    <Link
                      to={`/products?brand=${product.brand.slug}`}
                      className="eyebrow hover:text-fg"
                    >
                      {product.brand.name}
                    </Link>
                  )}
                  <h1 className="text-display mt-2 text-[clamp(2.4rem,4.5vw,3.8rem)]">
                    {product.name}
                  </h1>
                </div>
                <WishlistButton productId={product.id} productName={product.name} />
              </div>
              {product.ratingCount > 0 && (
                <a
                  href="#reviews"
                  className="inline-flex items-center gap-2 py-1.5 text-sm hover:underline"
                >
                  <Rating value={product.ratingAverage} />
                  <span className="text-muted">
                    {product.ratingAverage.toFixed(1)} · {product.ratingCount} reviews
                  </span>
                </a>
              )}
              <Price price={price} compareAtPrice={compareAtPrice} size="lg" animated />
              <p className="text-xs text-muted">Inclusive of all taxes calculated at checkout</p>
              {product.shortDescription !== null && (
                <p className="text-lg leading-relaxed text-fg/80">{product.shortDescription}</p>
              )}
            </motion.div>

            {product.hasVariants && (
              <VariantPicker
                options={product.options}
                variants={product.variants}
                selection={selection}
                onChange={(next) => {
                  setSelection(next);
                  setQuantity(1);
                }}
              />
            )}

            <div className="space-y-5 rounded-[28px] border border-border bg-surface p-6">
              <StockIndicator stock={stock} />
              <div ref={ctaRef} className="flex flex-wrap items-center gap-3">
                <QuantityStepper
                  value={quantity}
                  max={Math.max(Math.min(stock, 10), 1)}
                  onChange={setQuantity}
                />
                <Magnetic strength={0.15}>
                  <Button
                    size="lg"
                    disabled={!canBuy}
                    loading={pending === 'add'}
                    onClick={() => {
                      void add('add');
                    }}
                    className="min-w-52"
                  >
                    <ShoppingBag className="size-4" />
                    {canBuy ? 'Add to bag' : 'Unavailable'}
                  </Button>
                </Magnetic>
                <Button
                  size="lg"
                  variant="accent"
                  disabled={!canBuy}
                  loading={pending === 'buy'}
                  onClick={() => {
                    void add('buy');
                  }}
                >
                  <Zap className="size-4" /> Buy now
                </Button>
              </div>
              <ul className="grid gap-3 border-t border-border pt-5 text-sm sm:grid-cols-3">
                <li className="flex items-center gap-2 text-fg/80">
                  <Truck className="size-4 text-accent" /> Arrives {deliveryEstimate()}
                </li>
                <li className="flex items-center gap-2 text-fg/80">
                  <RotateCcw className="size-4 text-accent" /> 7-day returns
                </li>
                <li className="flex items-center gap-2 text-fg/80">
                  <ShieldCheck className="size-4 text-accent" /> Secure checkout
                </li>
              </ul>
            </div>

            <div>
              <Accordion title="Description" defaultOpen>
                <p className="whitespace-pre-line">{product.description}</p>
              </Accordion>
              <Accordion title="Details">
                <dl className="grid grid-cols-[120px_1fr] gap-y-2">
                  <dt className="text-muted">SKU</dt>
                  <dd>{variant?.sku ?? product.sku}</dd>
                  <dt className="text-muted">Category</dt>
                  <dd>{product.category.name}</dd>
                  {product.brand !== null && (
                    <>
                      <dt className="text-muted">Brand</dt>
                      <dd>{product.brand.name}</dd>
                    </>
                  )}
                </dl>
              </Accordion>
              <Accordion title="Shipping & returns">
                Free shipping on orders over ₹999, otherwise a flat ₹79. Orders ship within 24 hours
                and arrive in 3–5 business days. Cash on delivery is available on every order, and
                unused items can be returned within 7 days.
              </Accordion>
            </div>
          </div>
        </div>

        <ReviewsSection
          productId={product.id}
          average={product.ratingAverage}
          count={product.ratingCount}
        />
      </div>

      {(related.data?.length ?? 0) > 0 && (
        <ProductRail
          eyebrow="You may also like"
          title="Pairs well with"
          products={related.data ?? []}
          loading={false}
          action={{
            to: `/category/${product.category.slug}`,
            label: `More in ${product.category.name}`,
          }}
        />
      )}

      {/* Portaled: the page transition animates `filter`, which would trap a fixed element. */}
      {createPortal(
        <AnimatePresence>
          {!ctaVisible && (
            <motion.div
              initial={{ y: '120%' }}
              animate={{ y: 0 }}
              exit={{ y: '120%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="glass fixed inset-x-3 bottom-3 z-30 flex items-center gap-3 rounded-full border border-border p-2 pl-3 shadow-2xl lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-[440px]"
            >
              {product.images[0] !== undefined && (
                <img
                  src={product.images[0].url}
                  alt=""
                  className="size-11 rounded-full bg-surface-2 object-contain p-1"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{product.name}</p>
                <Price price={price} compareAtPrice={null} size="sm" />
              </div>
              <Button
                disabled={!canBuy}
                loading={pending === 'add'}
                onClick={() => {
                  void add('add');
                }}
              >
                <ShoppingBag className="size-4" /> Add
              </Button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

export function ProductPage() {
  const { slug = '' } = useParams();
  const product = useQuery({
    queryKey: queryKeys.product(slug),
    queryFn: () => catalogApi.product(slug),
  });
  useDocumentTitle(product.data?.name);

  if (product.error instanceof ApiError && product.error.status === 404) {
    return <NotFoundPage />;
  }
  if (product.data === undefined) {
    return (
      <div className="container-page grid grid-cols-1 gap-12 py-14 lg:grid-cols-[1.15fr_1fr]">
        <Skeleton className="aspect-square rounded-[32px]" />
        <div className="space-y-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-14 w-4/5" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full rounded-[28px]" />
        </div>
      </div>
    );
  }

  // Keyed so variant and quantity state reset when navigating between products.
  return <ProductView key={product.data.id} product={product.data} />;
}
