import type { BrandDto, CategoryDto, ProductSummaryDto } from '@ecommerce/types';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Copy } from 'lucide-react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { Reveal, Skeleton, Tilt } from '@/components/ui/display';
import { ProductCard, ProductCardSkeleton } from '@/features/catalog/product-card';
import { cn } from '@/lib/utils';

export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: { to: string; label: string };
}) {
  return (
    <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow mb-3">{eyebrow}</p>
        <h2 className="text-display text-[clamp(2.4rem,5vw,4rem)]">{title}</h2>
      </div>
      {action !== undefined && (
        <Link
          to={action.to}
          className="group inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium transition hover:border-fg/30"
        >
          {action.label}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </Reveal>
  );
}

export function BrandMarquee({ brands }: { brands: BrandDto[] }) {
  const list = brands.filter((brand) => brand.productCount > 0).slice(0, 24);
  if (list.length === 0) {
    return null;
  }

  return (
    <section aria-label="Featured brands" className="border-y border-border bg-surface py-8">
      <div className="mask-fade-x group flex overflow-hidden">
        {[0, 1].map((copy) => (
          <div
            key={copy}
            aria-hidden={copy === 1}
            className="animate-marquee flex shrink-0 items-center gap-16 pr-16 group-hover:[animation-play-state:paused]"
          >
            {list.map((brand) => (
              <Link
                key={`${String(copy)}-${brand.id}`}
                to={`/products?brand=${brand.slug}`}
                tabIndex={copy === 1 ? -1 : undefined}
                className="text-display py-1.5 text-3xl whitespace-nowrap text-fg/35 transition-colors hover:text-fg"
              >
                {brand.name}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

const BENTO = [
  'lg:col-span-2 lg:row-span-2',
  'lg:col-span-1',
  'lg:col-span-1',
  'lg:col-span-1',
  'lg:col-span-1',
  'lg:col-span-2',
  'lg:col-span-2',
];

const TINTS = [
  'from-[oklch(93%_0.04_285)] to-[oklch(88%_0.07_300)]',
  'from-[oklch(94%_0.04_40)] to-[oklch(90%_0.06_20)]',
  'from-[oklch(94%_0.04_160)] to-[oklch(90%_0.06_180)]',
  'from-[oklch(95%_0.04_90)] to-[oklch(91%_0.07_70)]',
  'from-[oklch(94%_0.04_330)] to-[oklch(90%_0.07_350)]',
  'from-[oklch(94%_0.03_230)] to-[oklch(90%_0.06_250)]',
  'from-[oklch(94%_0.03_120)] to-[oklch(90%_0.05_140)]',
];

export function CategoryBento({
  categories,
  loading,
}: {
  categories: CategoryDto[];
  loading: boolean;
}) {
  return (
    <section className="container-page py-24">
      <SectionHeading
        eyebrow="Explore"
        title="Shop by category"
        action={{ to: '/products', label: 'All products' }}
      />
      <div className="grid auto-rows-[220px] grid-cols-2 gap-4 lg:grid-cols-4">
        {loading
          ? BENTO.map((span, index) => (
              <Skeleton key={index} className={cn('rounded-[28px]', span)} />
            ))
          : categories.slice(0, 7).map((category, index) => (
              <Reveal key={category.id} delay={index * 0.06} className={cn('group', BENTO[index])}>
                <Tilt className="size-full rounded-[28px]" max={6}>
                  <Link
                    to={`/category/${category.slug}`}
                    className={cn(
                      'relative flex size-full flex-col justify-between overflow-hidden rounded-[28px] bg-gradient-to-br p-6 dark:from-surface-2 dark:to-surface',
                      TINTS[index],
                    )}
                  >
                    <div className="relative z-10 flex items-start justify-between">
                      <div>
                        <h3 className="text-display text-3xl text-[oklch(20%_0.02_270)] lg:text-4xl dark:text-fg">
                          {category.name}
                        </h3>
                        <p className="mt-1 text-sm text-[oklch(35%_0.02_270)] dark:text-muted">
                          {category.productCount} products
                        </p>
                      </div>
                      <span className="grid size-10 place-items-center rounded-full bg-white/70 text-[oklch(20%_0.02_270)] transition duration-500 group-hover:rotate-45 group-hover:bg-white dark:bg-white/10 dark:text-fg">
                        <ArrowUpRight className="size-4" />
                      </span>
                    </div>
                    {category.image !== null && (
                      <img
                        src={category.image}
                        alt=""
                        loading="lazy"
                        className={cn(
                          'pointer-events-none absolute right-0 bottom-0 object-contain mix-blend-multiply transition duration-700 ease-[var(--ease-out-expo)] group-hover:scale-110 group-hover:-rotate-3 dark:mix-blend-normal',
                          index === 0 ? 'h-[78%] w-[78%]' : 'h-[62%] w-[62%]',
                        )}
                        style={{ transform: 'translateZ(40px)' }}
                      />
                    )}
                  </Link>
                </Tilt>
              </Reveal>
            ))}
      </div>
    </section>
  );
}

export function ProductRail({
  eyebrow,
  title,
  products,
  loading,
  action,
}: {
  eyebrow: string;
  title: string;
  products: ProductSummaryDto[];
  loading: boolean;
  action: { to: string; label: string };
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const scrollBy = (direction: 1 | -1) => {
    const element = scroller.current;
    element?.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <section className="py-16">
      <div className="container-page">
        <div className="flex items-end justify-between gap-4">
          <SectionHeading eyebrow={eyebrow} title={title} />
          <div className="mb-10 hidden gap-2 sm:flex">
            {([-1, 1] as const).map((direction) => (
              <motion.button
                key={direction}
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  scrollBy(direction);
                }}
                className="grid size-12 place-items-center rounded-full border border-border hover:bg-surface-2"
                aria-label={direction === 1 ? 'Scroll right' : 'Scroll left'}
              >
                {direction === 1 ? (
                  <ArrowRight className="size-4" />
                ) : (
                  <ArrowLeft className="size-4" />
                )}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
      <div
        ref={scroller}
        className="no-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth px-[max(1rem,calc((100vw-1400px)/2+2.5rem))] pb-4"
      >
        {loading
          ? Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="w-[260px] shrink-0 sm:w-[300px]">
                <ProductCardSkeleton />
              </div>
            ))
          : products.map((product, index) => (
              <div key={product.id} className="w-[260px] shrink-0 snap-start sm:w-[300px]">
                <ProductCard product={product} index={index} />
              </div>
            ))}
        <Link
          to={action.to}
          className="group flex w-[260px] shrink-0 snap-start flex-col items-center justify-center gap-4 rounded-[26px] border border-dashed border-border text-center sm:w-[300px]"
        >
          <span className="grid size-16 place-items-center rounded-full bg-fg text-bg transition group-hover:scale-110">
            <ArrowRight className="size-5" />
          </span>
          <span className="text-display text-2xl">{action.label}</span>
        </Link>
      </div>
    </section>
  );
}

export function PromoBanner() {
  const ref = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const x = useTransform(scrollYProgress, [0, 1], ['-10%', '10%']);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.92, 1, 0.96]);

  return (
    <motion.section ref={ref} style={{ scale }} className="container-page py-16">
      <div className="grain relative isolate overflow-hidden rounded-[40px] bg-[oklch(18%_0.03_280)] px-8 py-20 text-white sm:px-16">
        <motion.p
          aria-hidden
          style={{ x }}
          className="text-display pointer-events-none absolute inset-x-0 -bottom-6 text-center text-[22vw] leading-none whitespace-nowrap text-white/[0.04] select-none"
        >
          welcome welcome
        </motion.p>
        <div className="absolute -top-32 -right-24 -z-10 size-[520px] rounded-full bg-[radial-gradient(circle,oklch(60%_0.22_285/0.8),transparent_65%)] blur-2xl" />
        <div className="absolute -bottom-40 -left-24 -z-10 size-[420px] rounded-full bg-[radial-gradient(circle,oklch(65%_0.2_340/0.55),transparent_65%)] blur-2xl" />

        <div className="relative grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <p className="eyebrow mb-4 text-white/60">First order</p>
            <h2 className="text-display text-[clamp(2.6rem,5vw,4.6rem)]">
              Take <span className="text-[oklch(80%_0.14_285)]">10% off</span> your first order
            </h2>
            <p className="mt-5 max-w-md text-white/70">
              Applies to orders above ₹999, up to ₹500 off. Use it at checkout - no strings
              attached.
            </p>
          </Reveal>
          <Reveal delay={0.15} className="flex flex-col items-start gap-4 lg:items-end">
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                void navigator.clipboard
                  .writeText('WELCOME10')
                  .then(() => {
                    setCopied(true);
                    toast.success('Code copied - paste it at checkout');
                    window.setTimeout(() => {
                      setCopied(false);
                    }, 2000);
                  })
                  .catch(() => {
                    toast('Your code is WELCOME10');
                  });
              }}
              className="flex items-center gap-4 rounded-3xl border border-dashed border-white/40 bg-white/5 px-7 py-5 backdrop-blur"
              aria-label="Copy coupon code WELCOME10"
            >
              <span className="font-mono text-3xl font-bold tracking-[0.2em]">WELCOME10</span>
              <motion.span
                key={copied ? 'copied' : 'copy'}
                initial={{ scale: 0.4, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                className={cn(
                  'grid size-10 place-items-center rounded-full',
                  copied ? 'bg-success' : 'bg-white text-black',
                )}
              >
                {copied ? <Check className="size-5" /> : <Copy className="size-4" />}
              </motion.span>
            </motion.button>
            <Link
              to="/products"
              className="text-sm text-white/70 underline-offset-4 hover:text-white hover:underline"
            >
              Start shopping →
            </Link>
          </Reveal>
        </div>
      </div>
    </motion.section>
  );
}
