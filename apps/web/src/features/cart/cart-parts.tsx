import { formatMoney, PRICING } from '@ecommerce/shared';
import { AlertTriangle, PartyPopper, Trash2, Truck } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { QuantityStepper } from '@/components/ui/display';
import type { CartLine } from '@/hooks/use-cart';
import { errorMessage } from '@/lib/query';
import { cn, formatAttributes } from '@/lib/utils';

export function FreeShippingBar({ remaining }: { remaining: number }) {
  const progress = Math.min(1 - remaining / PRICING.freeShippingThreshold, 1);
  const unlocked = remaining === 0;

  return (
    <div className="rounded-2xl bg-surface-2 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={unlocked ? 'yes' : 'no'}
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            className={cn(
              'grid size-7 place-items-center rounded-full',
              unlocked ? 'bg-success text-white' : 'bg-accent-soft text-accent',
            )}
          >
            {unlocked ? <PartyPopper className="size-3.5" /> : <Truck className="size-3.5" />}
          </motion.span>
        </AnimatePresence>
        <p>
          {unlocked ? (
            <span className="font-medium">You’ve unlocked free shipping!</span>
          ) : (
            <>
              Add <span className="font-semibold">{formatMoney(remaining)}</span> more for free
              shipping
            </>
          )}
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border">
        <motion.div
          className={cn(
            'h-full rounded-full',
            unlocked
              ? 'bg-success'
              : 'bg-gradient-to-r from-[oklch(70%_0.16_285)] via-accent to-[oklch(62%_0.2_330)]',
          )}
          initial={false}
          animate={{ width: `${String(Math.max(progress, 0.04) * 100)}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}

export function CartLineItem({
  line,
  onQuantity,
  onRemove,
  compact = false,
  onNavigate,
}: {
  line: CartLine;
  onQuantity: (quantity: number) => Promise<void>;
  onRemove: () => Promise<void>;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const unavailable = line.availableStock === 0;
  const overStock = !unavailable && line.quantity > line.availableStock;
  const attributes = formatAttributes(line.attributes);

  const run = (action: Promise<void>) => {
    action.catch((error: unknown) => {
      toast.error(errorMessage(error));
    });
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{
        opacity: 0,
        x: -40,
        height: 0,
        marginBottom: 0,
        paddingBottom: 0,
        transition: { duration: 0.28 },
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex gap-4 border-b border-border pb-5"
    >
      <Link
        to={`/products/${line.slug}`}
        onClick={onNavigate}
        className={cn(
          'shrink-0 overflow-hidden rounded-2xl bg-surface-2',
          compact ? 'size-20' : 'size-24 sm:size-28',
        )}
      >
        {line.image !== null && (
          <img
            src={line.image}
            alt={line.name}
            className="size-full object-contain p-2 mix-blend-multiply dark:mix-blend-normal"
          />
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {line.brand !== null && <p className="eyebrow">{line.brand}</p>}
            <Link
              to={`/products/${line.slug}`}
              onClick={onNavigate}
              className="line-clamp-2 text-sm font-medium hover:underline"
            >
              {line.name}
            </Link>
            {attributes !== '' && <p className="mt-0.5 text-xs text-muted">{attributes}</p>}
          </div>
          <p className="text-sm font-semibold tabular-nums">{formatMoney(line.lineTotal)}</p>
        </div>

        {line.priceChanged && (
          <p className="text-xs text-warning">Price updated to {formatMoney(line.unitPrice)}</p>
        )}
        {(unavailable || overStock) && (
          <p className="flex items-center gap-1 text-xs text-sale">
            <AlertTriangle className="size-3" />
            {unavailable ? 'No longer available' : `Only ${String(line.availableStock)} left`}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          <QuantityStepper
            size="sm"
            value={line.quantity}
            max={Math.max(Math.min(line.availableStock, 10), 1)}
            onChange={(quantity) => {
              run(onQuantity(quantity));
            }}
          />
          <motion.button
            type="button"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              run(onRemove());
            }}
            className="grid size-9 place-items-center rounded-full text-muted hover:bg-sale/10 hover:text-sale"
            aria-label={`Remove ${line.name}`}
          >
            <Trash2 className="size-4" />
          </motion.button>
        </div>
      </div>
    </motion.li>
  );
}
