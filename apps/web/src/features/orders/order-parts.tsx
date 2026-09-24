import type { OrderStatus, PaymentStatus } from '@ecommerce/shared';
import type { OrderEventDto } from '@ecommerce/types';
import { Check, CircleDot, Package, PackageCheck, Truck, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';

import { Badge } from '@/components/ui/display';
import { cn, formatDateTime, humanize } from '@/lib/utils';

const STATUS_TONE: Record<OrderStatus, 'neutral' | 'accent' | 'success' | 'warning' | 'sale'> = {
  PENDING: 'warning',
  CONFIRMED: 'accent',
  PROCESSING: 'accent',
  SHIPPED: 'accent',
  DELIVERED: 'success',
  CANCELLED: 'sale',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const tone = STATUS_TONE[status];
  return <Badge tone={tone === 'sale' ? 'neutral' : tone}>{humanize(status)}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const tone = status === 'PAID' ? 'success' : status === 'FAILED' ? 'sale' : 'neutral';
  return <Badge tone={tone}>Payment {status.toLowerCase()}</Badge>;
}

const TRACK: { status: OrderStatus; label: string; icon: typeof Package }[] = [
  { status: 'CONFIRMED', label: 'Confirmed', icon: CircleDot },
  { status: 'PROCESSING', label: 'Packed', icon: Package },
  { status: 'SHIPPED', label: 'Shipped', icon: Truck },
  { status: 'DELIVERED', label: 'Delivered', icon: PackageCheck },
];

/** Horizontal progress tracker with an animated fill up to the current stage. */
export function OrderTracker({ status, events }: { status: OrderStatus; events: OrderEventDto[] }) {
  if (status === 'CANCELLED') {
    return (
      <div className="flex items-center gap-3 rounded-3xl bg-sale/10 p-5 text-sale">
        <XCircle className="size-5" /> This order was cancelled.
      </div>
    );
  }

  const reached = TRACK.findIndex((stage) => stage.status === status);
  const progress = reached < 0 ? 0 : reached / (TRACK.length - 1);
  const timeFor = (stage: OrderStatus) => events.find((event) => event.status === stage)?.createdAt;

  return (
    <div className="relative px-2 pt-2 pb-1">
      <div className="absolute top-7 right-8 left-8 h-1 rounded-full bg-border" aria-hidden>
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-accent to-success"
          initial={{ width: 0 }}
          animate={{ width: `${String(progress * 100)}%` }}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <ol className="relative flex justify-between">
        {TRACK.map((stage, index) => {
          const done = index <= reached;
          const Icon = done && index < reached ? Check : stage.icon;
          const at = timeFor(stage.status);
          return (
            <li key={stage.status} className="flex w-20 flex-col items-center gap-2 text-center">
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  delay: 0.25 + index * 0.18,
                  type: 'spring',
                  stiffness: 300,
                  damping: 18,
                }}
                className={cn(
                  'grid size-11 place-items-center rounded-full border-2 bg-bg',
                  done ? 'border-accent text-accent' : 'border-border text-subtle',
                  index === reached && 'shadow-[0_0_0_6px_var(--ring)]',
                )}
              >
                <Icon className="size-4" />
              </motion.span>
              <span className={cn('text-xs font-medium', done ? 'text-fg' : 'text-muted')}>
                {stage.label}
              </span>
              {at !== undefined && (
                <span className="text-[10px] text-subtle">{formatDateTime(at)}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const CONFETTI_COLORS = ['#6d5ef5', '#f472b6', '#facc15', '#34d399', '#60a5fa', '#fb7185'];

/** Lightweight canvas confetti burst; skipped entirely when reduced motion is preferred. */
export function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (
      canvas === null ||
      context === null ||
      context === undefined ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const ratio = window.devicePixelRatio;
    canvas.width = window.innerWidth * ratio;
    canvas.height = window.innerHeight * ratio;
    context.scale(ratio, ratio);

    const pieces = Array.from({ length: 160 }, (_, index) => ({
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 16,
      vy: Math.random() * -14 - 4,
      size: Math.random() * 8 + 4,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length] ?? '#6d5ef5',
    }));

    let frame = 0;
    let handle = 0;
    const draw = () => {
      frame += 1;
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const piece of pieces) {
        piece.vy += 0.35;
        piece.vx *= 0.99;
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.rotation += piece.spin;
        context.save();
        context.globalAlpha = Math.max(1 - frame / 180, 0);
        context.translate(piece.x, piece.y);
        context.rotate(piece.rotation);
        context.fillStyle = piece.color;
        context.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
        context.restore();
      }
      if (frame < 180) {
        handle = requestAnimationFrame(draw);
      }
    };
    handle = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(handle);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[80] size-full"
    />
  );
}
