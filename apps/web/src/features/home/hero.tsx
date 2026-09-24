import type { ProductSummaryDto } from '@ecommerce/types';
import { ArrowRight, Sparkles } from 'lucide-react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { Link, useNavigate } from 'react-router';

import { Button, Magnetic } from '@/components/ui/button';
import { CountUp, Rating, Skeleton, SplitText } from '@/components/ui/display';
import { formatMoney } from '@ecommerce/shared';

function FloatingProduct({
  product,
  className,
  depth,
  delay,
  progress,
}: {
  product: ProductSummaryDto;
  className: string;
  depth: number;
  delay: number;
  progress: ReturnType<typeof useScroll>['scrollYProgress'];
}) {
  const y = useTransform(progress, [0, 1], [0, -160 * depth]);
  const rotate = useTransform(progress, [0, 1], [0, 8 * depth * (depth % 2 === 0 ? 1 : -1)]);

  return (
    <motion.div style={{ y, rotate }} className={`absolute ${className}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 1.1, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        <Link
          to={`/products/${product.slug}`}
          className="group animate-float block rounded-[28px] border border-white/60 bg-white/70 p-3 shadow-[0_30px_80px_-30px_rgb(40_20_90/0.45)] backdrop-blur-xl transition-transform duration-500 hover:scale-[1.04] dark:border-white/10 dark:bg-white/5"
          style={{ animationDelay: `${String(delay * 2)}s` }}
        >
          <div className="aspect-square overflow-hidden rounded-[20px] bg-gradient-to-br from-white to-[oklch(95%_0.02_285)] dark:from-white/10 dark:to-white/5">
            {product.image !== null && (
              <img
                src={product.image.url}
                alt={product.name}
                className="size-full object-contain p-4 transition duration-700 group-hover:scale-110"
              />
            )}
          </div>
          <div className="flex items-center justify-between gap-3 px-1 pt-3 pb-1">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[oklch(20%_0.02_270)] dark:text-white">
                {product.name}
              </p>
              <Rating value={product.ratingAverage} size={11} />
            </div>
            <span className="rounded-full bg-[oklch(20%_0.02_270)] px-2.5 py-1 text-xs font-semibold text-white dark:bg-white dark:text-black">
              {formatMoney(product.price)}
            </span>
          </div>
        </Link>
      </motion.div>
    </motion.div>
  );
}

export function Hero({ featured }: { featured: ProductSummaryDto[] }) {
  const ref = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const [first, second, third] = featured;

  return (
    <section ref={ref} className="grain relative isolate overflow-hidden">
      {/* The blobs are placed from the top in viewport units, not as a share of the hero's height,
          so they stay put when content below them loads and the hero grows. */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <div className="animate-aurora absolute -top-[25vmax] -left-1/4 size-[70vmax] rounded-full bg-[radial-gradient(circle,oklch(75%_0.14_285/0.55),transparent_60%)] blur-3xl" />
        <div
          className="animate-aurora absolute top-[30vmax] -right-1/4 size-[65vmax] rounded-full bg-[radial-gradient(circle,oklch(80%_0.12_330/0.45),transparent_60%)] blur-3xl"
          style={{ animationDelay: '-6s' }}
        />
        <div
          className="animate-aurora absolute top-[18vmax] left-1/3 size-[40vmax] rounded-full bg-[radial-gradient(circle,oklch(85%_0.12_200/0.35),transparent_60%)] blur-3xl"
          style={{ animationDelay: '-12s' }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_60%,var(--bg))]" />
        <div className="absolute inset-0 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:72px_72px] opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      </div>

      <div className="container-page grid grid-cols-1 items-center gap-12 py-16 sm:py-20 xl:min-h-[calc(100svh-7rem)] xl:grid-cols-[1.1fr_1fr] xl:py-10">
        <motion.div
          style={{ y: contentY, opacity: contentOpacity }}
          className="relative z-10 max-w-2xl"
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="glass mb-8 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium"
          >
            <span className="grid size-5 place-items-center rounded-full bg-accent text-accent-fg">
              <Sparkles className="size-3" />
            </span>
            New season edit - up to 40% off
          </motion.div>

          <h1 className="text-display text-[clamp(2.6rem,4.6vw,4.5rem)]">
            <SplitText text="Objects of desire," />
            <br />
            <span>
              <SplitText
                text="delivered."
                delay={0.25}
                className="bg-gradient-to-r from-[oklch(55%_0.21_285)] via-[oklch(62%_0.22_320)] to-[oklch(68%_0.18_20)] bg-clip-text text-transparent dark:from-[oklch(75%_0.15_285)] dark:via-[oklch(78%_0.15_320)] dark:to-[oklch(80%_0.14_20)]"
              />
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="mt-7 max-w-lg text-lg leading-relaxed text-muted"
          >
            A considered edit of electronics, fashion, beauty and home - from brands we trust, with
            free shipping over ₹999 and cash on delivery everywhere.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <Magnetic>
              <Button
                size="lg"
                onClick={() => {
                  void navigate('/products');
                }}
              >
                Shop the collection
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Magnetic>
            <Magnetic strength={0.2}>
              <Button
                size="lg"
                variant="outline"
                className="glass"
                onClick={() => {
                  void navigate('/products?sort=popular');
                }}
              >
                Bestsellers
              </Button>
            </Magnetic>
          </motion.div>

          <motion.dl
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-14 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-8"
          >
            {[
              { label: 'Curated products', value: 100, suffix: '+' },
              { label: 'Trusted brands', value: 47, suffix: '' },
              { label: 'Happy reviews', value: 298, suffix: '' },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-xs text-muted">{stat.label}</dt>
                <dd className="text-display mt-1 text-4xl">
                  <CountUp value={stat.value} suffix={stat.suffix} />
                </dd>
              </div>
            ))}
          </motion.dl>

          {/* Tablets and small laptops: the collage becomes a compact strip of featured products. */}
          <div className="mt-12 hidden grid-cols-3 gap-4 md:grid xl:hidden">
            {/* Placeholders with the same box size hold the space while the products load. */}
            {featured.length === 0 &&
              Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  aria-hidden
                  className="rounded-3xl border border-white/60 bg-white/70 p-2.5 dark:border-white/10 dark:bg-white/5"
                >
                  <Skeleton className="aspect-square rounded-2xl" />
                  <p className="invisible mt-2 px-1 text-sm">&nbsp;</p>
                  <p className="invisible px-1 pb-1 text-sm">&nbsp;</p>
                </div>
              ))}
            {featured.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + index * 0.12, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  to={`/products/${product.slug}`}
                  className="group block rounded-3xl border border-white/60 bg-white/70 p-2.5 shadow-[0_20px_50px_-30px_rgb(40_20_90/0.45)] backdrop-blur-xl transition-transform duration-500 hover:-translate-y-1 dark:border-white/10 dark:bg-white/5"
                >
                  <div className="aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-white to-[oklch(95%_0.02_285)] dark:from-white/10 dark:to-white/5">
                    {product.image !== null && (
                      <img
                        src={product.image.url}
                        alt={product.name}
                        className="size-full object-contain p-3 transition duration-700 group-hover:scale-110"
                      />
                    )}
                  </div>
                  <p className="mt-2 truncate px-1 text-sm font-medium text-[oklch(20%_0.02_270)] dark:text-white">
                    {product.name}
                  </p>
                  <p className="px-1 pb-1 text-sm text-muted">{formatMoney(product.price)}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className="relative hidden h-[640px] xl:block" aria-label="Featured products">
          {first !== undefined && (
            <FloatingProduct
              product={first}
              className="top-4 left-10 w-[270px]"
              depth={1}
              delay={0.3}
              progress={scrollYProgress}
            />
          )}
          {second !== undefined && (
            <FloatingProduct
              product={second}
              className="top-40 right-0 w-[240px]"
              depth={2}
              delay={0.45}
              progress={scrollYProgress}
            />
          )}
          {third !== undefined && (
            <FloatingProduct
              product={third}
              className="bottom-0 left-28 w-[230px]"
              depth={3}
              delay={0.6}
              progress={scrollYProgress}
            />
          )}
        </div>
      </div>
    </section>
  );
}
