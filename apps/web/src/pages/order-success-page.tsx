import { formatMoney } from '@ecommerce/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, Package } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/display';
import { Confetti } from '@/features/orders/order-parts';
import { useDocumentTitle } from '@/hooks/use-utils';
import { queryKeys } from '@/lib/query';
import { pluralize } from '@/lib/utils';
import { ordersApi } from '@/services/shopping.api';

export function OrderSuccessPage() {
  useDocumentTitle('Order placed');
  const { id = '' } = useParams();
  const order = useQuery({ queryKey: queryKeys.order(id), queryFn: () => ordersApi.get(id) });

  return (
    <div className="container-page grid min-h-[70vh] place-items-center py-16">
      <Confetti />
      <div className="w-full max-w-xl text-center">
        <div className="relative mx-auto mb-10 size-28">
          {[0, 1, 2].map((ring) => (
            <motion.span
              key={ring}
              className="absolute inset-0 rounded-full border-2 border-success"
              initial={{ scale: 0.6, opacity: 0.8 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{
                duration: 2,
                delay: 0.4 + ring * 0.35,
                repeat: Infinity,
                repeatDelay: 1,
              }}
            />
          ))}
          <motion.div
            initial={{ scale: 0, rotate: -120 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.1 }}
            className="relative grid size-28 place-items-center rounded-full bg-success text-white shadow-[0_20px_60px_-15px_var(--success)]"
          >
            <svg viewBox="0 0 24 24" className="size-12" aria-hidden>
              <motion.path
                d="M5 12.5l4.5 4.5L19 7.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: 0.45, ease: 'easeOut' }}
              />
            </svg>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <p className="eyebrow mb-3">Thank you</p>
          <h1 className="text-display text-[clamp(2.8rem,6vw,4.4rem)]">Your order is confirmed</h1>
          <p className="mx-auto mt-4 max-w-md text-muted">
            We’ve emailed your receipt and will let you know as soon as it ships.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-10 rounded-[28px] border border-border bg-surface p-6 text-left card-shadow"
        >
          {order.data === undefined ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-16" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted">Order number</p>
                  <p className="font-mono text-lg font-semibold">{order.data.orderNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted">Total</p>
                  <p className="text-lg font-semibold">{formatMoney(order.data.total)}</p>
                </div>
              </div>
              <div className="mt-5 flex -space-x-3">
                {order.data.items.slice(0, 5).map((item, index) => (
                  <motion.span
                    key={item.id}
                    initial={{ scale: 0, x: -10 }}
                    animate={{ scale: 1, x: 0 }}
                    transition={{ delay: 1 + index * 0.08, type: 'spring' }}
                    className="size-14 overflow-hidden rounded-2xl border-2 border-surface bg-surface-2"
                  >
                    {item.image !== null && (
                      <img
                        src={item.image}
                        alt={item.productName}
                        className="size-full object-contain p-1"
                      />
                    )}
                  </motion.span>
                ))}
              </div>
              <p className="mt-4 flex items-center gap-2 text-sm text-muted">
                <Check className="size-4 text-success" />
                {order.data.paymentMethod === 'COD' ? 'Pay on delivery' : 'Payment received'} ·{' '}
                {pluralize(order.data.itemCount, 'item')}
              </p>
            </>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-8 flex flex-wrap justify-center gap-3"
        >
          <Link to={`/orders/${id}`}>
            <Button size="lg">
              <Package className="size-4" /> Track order
            </Button>
          </Link>
          <Link to="/products">
            <Button size="lg" variant="outline">
              Keep shopping <ArrowRight className="size-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
