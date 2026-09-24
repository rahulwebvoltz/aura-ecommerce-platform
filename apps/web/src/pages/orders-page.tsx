import { formatMoney } from '@ecommerce/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronRight, Package } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/display';
import { Pagination } from '@/components/ui/pagination';
import { AccountShell } from '@/features/account/account-shell';
import { OrderStatusBadge } from '@/features/orders/order-parts';
import { useDocumentTitle } from '@/hooks/use-utils';
import { queryKeys } from '@/lib/query';
import { formatDate, pluralize } from '@/lib/utils';
import { ordersApi } from '@/services/shopping.api';

export function OrdersPage() {
  useDocumentTitle('Your orders');
  const [page, setPage] = useState(1);
  const orders = useQuery({
    queryKey: queryKeys.orders(page),
    queryFn: () => ordersApi.list(page),
    placeholderData: keepPreviousData,
  });

  return (
    <AccountShell title="Orders" description="Track, manage and review everything you’ve bought.">
      {orders.isPending ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-36 rounded-3xl" />
          ))}
        </div>
      ) : orders.data === undefined || orders.data.data.length === 0 ? (
        <EmptyState
          icon={<Package className="size-7" />}
          title="No orders yet"
          description="When you place an order, it’ll show up here with live tracking."
          action={
            <Link to="/products">
              <Button>Start shopping</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {orders.data.data.map((order, index) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                to={`/orders/${order.id}`}
                className="group flex flex-col gap-5 rounded-3xl border border-border bg-surface p-5 transition hover:border-fg/25 hover:shadow-[0_20px_50px_-30px_rgb(0_0_0/0.4)] sm:flex-row sm:items-center"
              >
                <div className="flex -space-x-4">
                  {order.previewImages.slice(0, 3).map((image) => (
                    <span
                      key={image}
                      className="size-16 overflow-hidden rounded-2xl border-2 border-surface bg-surface-2"
                    >
                      <img src={image} alt="" className="size-full object-contain p-1" />
                    </span>
                  ))}
                  {order.previewImages.length === 0 && (
                    <span className="grid size-16 place-items-center rounded-2xl bg-surface-2">
                      <Package className="size-5 text-muted" />
                    </span>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold">{order.orderNumber}</span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <p className="text-sm text-muted">
                    Placed {formatDate(order.createdAt)} · {pluralize(order.itemCount, 'item')} ·{' '}
                    {order.paymentMethod === 'COD' ? 'Cash on delivery' : 'Paid online'}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <span className="text-lg font-semibold">{formatMoney(order.total)}</span>
                  <ChevronRight className="size-5 text-muted transition group-hover:translate-x-1 group-hover:text-fg" />
                </div>
              </Link>
            </motion.div>
          ))}
          <div className="pt-6">
            <Pagination page={page} totalPages={orders.data.meta.totalPages} onChange={setPage} />
          </div>
        </div>
      )}
    </AccountShell>
  );
}
