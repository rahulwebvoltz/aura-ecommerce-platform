import { formatMoney } from '@ecommerce/shared';
import type { AddressSnapshot, OrderDetailDto } from '@ecommerce/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CreditCard, MessageSquarePlus, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/display';
import { Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/overlay';
import { AccountShell } from '@/features/account/account-shell';
import { OrderStatusBadge, OrderTracker, PaymentStatusBadge } from '@/features/orders/order-parts';
import { useDocumentTitle } from '@/hooks/use-utils';
import { payWithRazorpay } from '@/lib/razorpay';
import { errorMessage, queryKeys } from '@/lib/query';
import { formatAttributes, formatDateTime } from '@/lib/utils';
import { ApiError } from '@/services/api-client';
import { checkoutApi, ordersApi } from '@/services/shopping.api';

import { NotFoundPage } from './error-page';

function AddressBlock({ title, address }: { title: string; address: AddressSnapshot }) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-5 text-sm">
      <p className="eyebrow mb-3">{title}</p>
      <p className="font-medium">
        {address.firstName} {address.lastName}
      </p>
      <p className="mt-1 leading-relaxed text-muted">
        {address.addressLine1}
        {address.addressLine2 !== null && `, ${address.addressLine2}`}
        <br />
        {address.city}, {address.state} {address.postalCode}
        <br />
        {address.phone}
      </p>
    </div>
  );
}

function OrderView({ order }: { order: OrderDetailDto }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [paying, setPaying] = useState(false);

  const store = (updated: OrderDetailDto) => {
    queryClient.setQueryData(queryKeys.order(updated.id), updated);
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
  };

  const cancel = useMutation({
    mutationFn: () => ordersApi.cancel(order.id, reason.trim() === '' ? undefined : reason.trim()),
    onSuccess: (updated) => {
      store(updated);
      setConfirming(false);
      toast.success('Your order has been cancelled');
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const payNow = async () => {
    setPaying(true);
    try {
      const payment = await checkoutApi.createPayment(order.id);
      if (payment.provider !== 'RAZORPAY') {
        return;
      }
      const success = await payWithRazorpay(payment);
      if (success !== null) {
        store(await checkoutApi.verifyPayment({ orderId: order.id, ...success }));
        toast.success('Payment received - thank you!');
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPaying(false);
    }
  };

  const awaitingPayment =
    order.paymentMethod === 'RAZORPAY' &&
    order.status !== 'CANCELLED' &&
    order.paymentStatus !== 'PAID';

  return (
    <AccountShell
      title={`Order ${order.orderNumber}`}
      description={`Placed ${formatDateTime(order.createdAt)}`}
    >
      <Link
        to="/orders"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" /> All orders
      </Link>

      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>

        {awaitingPayment && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-warning/40 bg-warning/10 p-5"
          >
            <p className="text-sm">
              <span className="font-semibold">Payment pending.</span> Complete payment to confirm
              this order.
            </p>
            <Button
              variant="accent"
              loading={paying}
              onClick={() => {
                void payNow();
              }}
            >
              <CreditCard className="size-4" /> Pay {formatMoney(order.total)}
            </Button>
          </motion.div>
        )}

        <div className="rounded-3xl border border-border bg-surface p-6">
          <OrderTracker status={order.status} events={order.events} />
        </div>

        <div className="rounded-3xl border border-border bg-surface">
          <ul className="divide-y divide-border">
            {order.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-4 p-5">
                <span className="size-20 shrink-0 overflow-hidden rounded-2xl bg-surface-2">
                  {item.image !== null && (
                    <img
                      src={item.image}
                      alt={item.productName}
                      className="size-full object-contain p-2"
                    />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  {item.productSlug === null ? (
                    <p className="font-medium">{item.productName}</p>
                  ) : (
                    <Link
                      to={`/products/${item.productSlug}`}
                      className="font-medium hover:underline"
                    >
                      {item.productName}
                    </Link>
                  )}
                  <p className="text-xs text-muted">
                    {formatAttributes(item.attributes)} {item.attributes === null ? '' : '·'} SKU{' '}
                    {item.sku}
                  </p>
                  <p className="mt-1 text-sm">
                    {formatMoney(item.price)} × {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {order.status === 'DELIVERED' && item.productSlug !== null && !item.reviewed && (
                    <Link to={`/products/${item.productSlug}#reviews`}>
                      <Button variant="outline" size="sm">
                        <MessageSquarePlus className="size-3.5" /> Review
                      </Button>
                    </Link>
                  )}
                  <span className="font-semibold">{formatMoney(item.total)}</span>
                </div>
              </li>
            ))}
          </ul>
          <dl className="space-y-2 border-t border-border p-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd>{formatMoney(order.subtotal)}</dd>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-success">
                <dt>Discount {order.couponCode !== null && `(${order.couponCode})`}</dt>
                <dd>−{formatMoney(order.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted">Shipping</dt>
              <dd>{order.shipping === 0 ? 'Free' : formatMoney(order.shipping)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">GST</dt>
              <dd>{formatMoney(order.tax)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatMoney(order.total)}</dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <AddressBlock title="Shipping address" address={order.shippingAddress} />
          <AddressBlock title="Billing address" address={order.billingAddress} />
        </div>

        {order.canCancel && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              className="text-sale hover:border-sale/40 hover:bg-sale/10"
              onClick={() => {
                setConfirming(true);
              }}
            >
              <XCircle className="size-4" /> Cancel order
            </Button>
          </div>
        )}
      </div>

      <Modal
        open={confirming}
        onClose={() => {
          setConfirming(false);
        }}
        title="Cancel order"
      >
        <div className="space-y-5 p-6">
          <div>
            <h2 className="text-display text-3xl">Cancel this order?</h2>
            <p className="mt-1 text-sm text-muted">
              Items go back into stock and any online payment is refunded to its original method.
            </p>
          </div>
          <Textarea
            label="Reason (optional)"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
            maxLength={500}
            placeholder="Help us improve"
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                setConfirming(false);
              }}
            >
              Keep order
            </Button>
            <Button
              variant="danger"
              loading={cancel.isPending}
              onClick={() => {
                cancel.mutate();
              }}
            >
              Cancel order
            </Button>
          </div>
        </div>
      </Modal>
    </AccountShell>
  );
}

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const order = useQuery({ queryKey: queryKeys.order(id), queryFn: () => ordersApi.get(id) });
  useDocumentTitle(order.data === undefined ? 'Order' : `Order ${order.data.orderNumber}`);

  if (
    order.error instanceof ApiError &&
    (order.error.status === 404 || order.error.status === 422)
  ) {
    return <NotFoundPage />;
  }
  if (order.data === undefined) {
    return (
      <AccountShell title="Order">
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </AccountShell>
    );
  }

  return <OrderView order={order.data} />;
}
