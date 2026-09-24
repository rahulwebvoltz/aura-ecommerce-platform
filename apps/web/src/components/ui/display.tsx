import { discountPercent, formatMoney } from '@ecommerce/shared';
import { Minus, Plus, Star } from 'lucide-react';
import {
  animate,
  motion,
  type MotionProps,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import { type ReactNode, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton', className)} />;
}

const badgeTones = {
  neutral: 'bg-surface-2 text-fg',
  accent: 'bg-accent-soft text-accent',
  sale: 'bg-sale text-white',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/20 text-[color-mix(in_oklch,var(--warning),black_35%)] dark:text-warning',
  dark: 'bg-fg text-bg',
} as const;

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: keyof typeof badgeTones;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide',
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Tweens between values so price and total changes read as motion rather than a jump. */
export function AnimatedNumber({
  value,
  format = (amount) => formatMoney(amount),
  className,
}: {
  value: number;
  format?: (value: number) => string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(value);
  const display = useTransform(motionValue, (latest) => format(Math.round(latest)));

  useEffect(() => {
    if (reduce === true) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: 0.6, ease: [0.16, 1, 0.3, 1] });
    return () => {
      controls.stop();
    };
  }, [motionValue, reduce, value]);

  return <motion.span className={cn('tabular-nums', className)}>{display}</motion.span>;
}

export function Price({
  price,
  compareAtPrice,
  size = 'md',
  animated = false,
  className,
}: {
  price: number;
  compareAtPrice: number | null;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}) {
  const off = discountPercent(price, compareAtPrice);
  const sizing = { sm: 'text-sm', md: 'text-base', lg: 'text-3xl' }[size];

  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-1', className)}>
      <span className={cn('font-semibold tracking-tight text-fg', sizing)}>
        {animated ? <AnimatedNumber value={price} /> : formatMoney(price)}
      </span>
      {off > 0 && compareAtPrice !== null && (
        <>
          <span className={cn('text-subtle line-through', size === 'lg' ? 'text-lg' : 'text-xs')}>
            {formatMoney(compareAtPrice)}
          </span>
          <span className={cn('font-semibold text-sale', size === 'lg' ? 'text-base' : 'text-xs')}>
            {off}% off
          </span>
        </>
      )}
    </div>
  );
}

export function Rating({
  value,
  count,
  size = 14,
  className,
}: {
  value: number;
  count?: number;
  size?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="relative flex" role="img" aria-label={`Rated ${value.toFixed(1)} out of 5`}>
        <div className="flex text-border">
          {Array.from({ length: 5 }, (_, index) => (
            <Star key={index} width={size} height={size} fill="currentColor" strokeWidth={0} />
          ))}
        </div>
        <div
          className="absolute inset-0 flex overflow-hidden text-warning"
          style={{ width: `${String((value / 5) * 100)}%` }}
        >
          {Array.from({ length: 5 }, (_, index) => (
            <Star
              key={index}
              width={size}
              height={size}
              fill="currentColor"
              strokeWidth={0}
              className="shrink-0"
            />
          ))}
        </div>
      </div>
      {count !== undefined && <span className="text-xs text-muted">({count})</span>}
    </div>
  );
}

export function QuantityStepper({
  value,
  max,
  onChange,
  size = 'md',
  label = 'Quantity',
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  size?: 'sm' | 'md';
  label?: string;
}) {
  const button = size === 'sm' ? 'size-8' : 'size-10';

  return (
    <div
      className="inline-flex items-center rounded-full border border-border bg-surface p-0.5"
      role="group"
      aria-label={label}
    >
      <motion.button
        type="button"
        whileTap={{ scale: 0.85 }}
        className={cn(
          button,
          'grid place-items-center rounded-full hover:bg-surface-2 disabled:opacity-30',
        )}
        onClick={() => {
          onChange(value - 1);
        }}
        disabled={value <= 1}
        aria-label="Decrease quantity"
      >
        <Minus className="size-3.5" />
      </motion.button>
      <span className="relative w-8 overflow-hidden text-center text-sm font-semibold tabular-nums">
        <motion.span
          key={value}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="inline-block"
          aria-live="polite"
        >
          {value}
        </motion.span>
      </span>
      <motion.button
        type="button"
        whileTap={{ scale: 0.85 }}
        className={cn(
          button,
          'grid place-items-center rounded-full hover:bg-surface-2 disabled:opacity-30',
        )}
        onClick={() => {
          onChange(value + 1);
        }}
        disabled={value >= max}
        aria-label="Increase quantity"
      >
        <Plus className="size-3.5" />
      </motion.button>
    </div>
  );
}

/** Fades and lifts children into view once, as they scroll onto the screen. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as = 'div',
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'li';
}) {
  const Component = motion[as];
  const props: MotionProps = {
    initial: { opacity: 0, y, filter: 'blur(6px)' },
    whileInView: { opacity: 1, y: 0, filter: 'blur(0px)' },
    viewport: { once: true, margin: '-60px' },
    transition: { duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] },
  };

  return (
    <Component className={className} {...props}>
      {children}
    </Component>
  );
}

/** Splits a headline into words that rise in one after another. */
export function SplitText({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const words = text.split(' ');
  return (
    <span className={className} aria-label={text}>
      {words.map((word, index) => (
        <span
          key={`${word}-${String(index)}`}
          className="inline-block overflow-hidden pb-[0.12em] align-bottom"
          aria-hidden
        >
          <motion.span
            className="inline-block"
            initial={{ y: '110%', rotate: 4 }}
            animate={{ y: '0%', rotate: 0 }}
            transition={{ duration: 0.9, delay: delay + index * 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            {word}
            {index < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** Card that tilts in 3D toward the cursor with a moving highlight. */
export function Tilt({
  children,
  className,
  max = 8,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 200, damping: 20 });
  const glareX = useTransform(px, (value) => `${String(value * 100)}%`);
  const glareY = useTransform(py, (value) => `${String(value * 100)}%`);
  const glare = useTransform(
    [glareX, glareY],
    ([x, y]) =>
      `radial-gradient(420px circle at ${String(x)} ${String(y)}, rgb(255 255 255 / 0.18), transparent 45%)`,
  );

  return (
    <motion.div
      ref={ref}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      className={cn('relative [transform-style:preserve-3d]', className)}
      onPointerMove={(event) => {
        const rect = ref.current?.getBoundingClientRect();
        if (rect === undefined || event.pointerType !== 'mouse') {
          return;
        }
        px.set((event.clientX - rect.left) / rect.width);
        py.set((event.clientY - rect.top) / rect.height);
      }}
      onPointerLeave={() => {
        px.set(0.5);
        py.set(0.5);
      }}
    >
      {children}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: glare }}
      />
    </motion.div>
  );
}

/** Counts up to `value` the first time it scrolls into view. */
export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const count = useMotionValue(0);
  const text = useTransform(
    count,
    (latest) => `${Math.round(latest).toLocaleString('en-IN')}${suffix}`,
  );

  useEffect(() => {
    if (!inView) {
      return;
    }
    const controls = animate(count, value, { duration: 1.6, ease: [0.16, 1, 0.3, 1] });
    return () => {
      controls.stop();
    };
  }, [count, inView, value]);

  return <motion.span ref={ref}>{text}</motion.span>;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center gap-4 rounded-[32px] border border-dashed border-border px-6 py-20 text-center"
    >
      <motion.div
        initial={{ rotate: -12, scale: 0.6 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
        className="grid size-16 place-items-center rounded-3xl bg-accent-soft text-accent"
      >
        {icon}
      </motion.div>
      <div className="space-y-1.5">
        <h2 className="text-display text-3xl">{title}</h2>
        <p className="mx-auto max-w-sm text-sm text-muted">{description}</p>
      </div>
      {action}
    </motion.div>
  );
}
