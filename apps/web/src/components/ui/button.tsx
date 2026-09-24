import { LoaderCircle } from 'lucide-react';
import { type HTMLMotionProps, motion, useMotionValue, useSpring } from 'motion/react';
import { forwardRef, type ReactNode, useRef } from 'react';

import { cn } from '@/lib/utils';

const variants = {
  primary:
    'bg-fg text-bg hover:bg-[color-mix(in_oklch,var(--fg),var(--accent)_28%)] shadow-[0_10px_30px_-12px_color-mix(in_oklch,var(--fg),transparent_40%)]',
  accent: 'bg-accent text-accent-fg hover:brightness-110 shadow-[0_12px_32px_-12px_var(--accent)]',
  secondary: 'bg-surface-2 text-fg hover:bg-[color-mix(in_oklch,var(--surface-2),var(--fg)_6%)]',
  outline: 'border border-border bg-transparent text-fg hover:border-fg/40 hover:bg-surface-2/60',
  ghost: 'bg-transparent text-fg hover:bg-surface-2',
  danger: 'bg-sale text-white hover:brightness-110',
} as const;

const sizes = {
  sm: 'h-9 px-3.5 text-[13px] gap-1.5 rounded-full',
  md: 'h-11 px-5 text-sm gap-2 rounded-full',
  lg: 'h-14 px-7 text-[15px] gap-2.5 rounded-full',
  icon: 'size-10 rounded-full',
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, className, children, ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type="button"
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      disabled={disabled === true || loading}
      aria-busy={loading}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-[background-color,border-color,color,filter,opacity] duration-200 select-none disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      <span className={cn('inline-flex items-center gap-[inherit]', loading && 'opacity-0')}>
        {children}
      </span>
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        </span>
      )}
    </motion.button>
  );
});

/** Wraps a control so it drifts toward the cursor, springing back when the pointer leaves. */
export function Magnetic({ children, strength = 0.3 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 16, mass: 0.4 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 16, mass: 0.4 });

  return (
    <motion.div
      ref={ref}
      style={{ x, y }}
      className="inline-block"
      onPointerMove={(event) => {
        const rect = ref.current?.getBoundingClientRect();
        if (rect === undefined || event.pointerType !== 'mouse') {
          return;
        }
        x.set((event.clientX - rect.left - rect.width / 2) * strength);
        y.set((event.clientY - rect.top - rect.height / 2) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
