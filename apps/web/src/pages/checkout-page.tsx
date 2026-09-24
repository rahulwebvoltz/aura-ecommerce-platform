import { calculateOrderTotals, formatMoney, type PaymentMethod } from '@ecommerce/shared';
import type { AddressDto, CouponValidationDto } from '@ecommerce/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CreditCard,
  Lock,
  Plus,
  Tag,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { AnimatedNumber, Skeleton } from '@/components/ui/display';
import { AddressCard, AddressForm } from '@/features/account/address-form';
import { useCart } from '@/hooks/use-cart';
import { useDocumentTitle } from '@/hooks/use-utils';
import { payWithRazorpay } from '@/lib/razorpay';
import { errorMessage, queryKeys } from '@/lib/query';
import { cn, formatAttributes, idempotencyKey, pluralize } from '@/lib/utils';
import { ApiError } from '@/services/api-client';
import { addressesApi, checkoutApi } from '@/services/shopping.api';

const STEPS = ['Address', 'Payment', 'Review'] as const;

function Stepper({ step, onStep }: { step: number; onStep: (step: number) => void }) {
  return (
    <ol className="relative mb-10 flex items-center justify-between">
      <div className="absolute top-5 right-5 left-5 h-0.5 bg-border" aria-hidden>
        <motion.div
          className="h-full bg-accent"
          initial={false}
          animate={{ width: `${String((step / (STEPS.length - 1)) * 100)}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
      {STEPS.map((label, index) => {
        const done = index < step;
        const current = index === step;
        return (
          <li key={label} className="relative z-10 flex flex-col items-center gap-2">
            <button
              type="button"
              disabled={index > step}
              onClick={() => {
                onStep(index);
              }}
              aria-current={current ? 'step' : undefined}
              className={cn(
                'grid size-10 place-items-center rounded-full border-2 text-sm font-semibold transition-colors',
                done && 'border-accent bg-accent text-accent-fg',
                current && 'border-accent bg-bg text-accent',
                !done && !current && 'border-border bg-bg text-muted',
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={done ? 'done' : 'num'}
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0 }}
                >
                  {done ? <Check className="size-4" strokeWidth={3} /> : index + 1}
                </motion.span>
              </AnimatePresence>
            </button>
            <span className={cn('text-xs font-medium', current ? 'text-fg' : 'text-muted')}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function StepPanel({ children, direction }: { children: ReactNode; direction: number }) {
  return (
    <motion.div
      custom={direction}
      initial={{ opacity: 0, x: direction * 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: direction * -40 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function CouponBox({
  applied,
  onApply,
  onRemove,
}: {
  applied: CouponValidationDto | null;
  onApply: (coupon: CouponValidationDto) => void;
  onRemove: () => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const mutation = useMutation({
    mutationFn: checkoutApi.validateCoupon,
    onSuccess: (coupon) => {
      setError(null);
      setCode('');
      onApply(coupon);
      toast.success(`${coupon.code} applied - you save ${formatMoney(coupon.discount)}`);
    },
    onError: (failure) => {
      setError(errorMessage(failure));
      setShake((value) => value + 1);
    },
  });

  if (applied !== null) {
    return (
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex items-center justify-between rounded-2xl border border-dashed border-success/50 bg-success/10 px-4 py-3"
      >
        <span className="flex items-center gap-2 text-sm">
          <Tag className="size-4 text-success" />
          <span className="font-mono font-semibold">{applied.code}</span>
          <span className="text-muted">· {applied.description}</span>
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="grid size-7 place-items-center rounded-full hover:bg-surface-2"
          aria-label="Remove coupon"
        >
          <X className="size-3.5" />
        </button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-2">
      <motion.form
        key={shake}
        animate={shake > 0 ? { x: [0, -8, 8, -5, 5, 0] } : {}}
        transition={{ duration: 0.4 }}
        onSubmit={(event) => {
          event.preventDefault();
          if (code.trim() !== '') {
            mutation.mutate(code.trim());
          }
        }}
        className={cn(
          'flex gap-2 rounded-full border bg-surface p-1.5',
          error === null ? 'border-border' : 'border-sale',
        )}
      >
        <input
          value={code}
          onChange={(event) => {
            setCode(event.target.value.toUpperCase());
            setError(null);
          }}
          placeholder="Coupon code"
          aria-label="Coupon code"
          className="min-w-0 flex-1 bg-transparent px-3 font-mono text-sm tracking-wider uppercase outline-none"
        />
        <Button type="submit" size="sm" loading={mutation.isPending} disabled={code.trim() === ''}>
          Apply
        </Button>
      </motion.form>
      {error !== null && <p className="px-3 text-xs text-sale">{error}</p>}
      <p className="px-3 text-xs text-muted">Try WELCOME10, FLAT200 or FESTIVE25</p>
    </div>
  );
}

export function CheckoutPage() {
  useDocumentTitle('Checkout');
  const cart = useCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('COD');
  const [coupon, setCoupon] = useState<CouponValidationDto | null>(null);
  const [attemptKey] = useState(idempotencyKey);
  const [processing, setProcessing] = useState(false);
  // Once an order exists the cart empties; this stops the empty-cart redirect from racing the
  // navigation to the order page.
  const [placed, setPlaced] = useState(false);

  const addresses = useQuery({ queryKey: queryKeys.addresses, queryFn: addressesApi.list });
  const methods = useQuery({
    queryKey: queryKeys.paymentMethods,
    queryFn: checkoutApi.paymentMethods,
  });

  const selectedAddress: AddressDto | undefined =
    addresses.data?.find((address) => address.id === addressId) ??
    addresses.data?.find((address) => address.isDefault) ??
    addresses.data?.[0];
  const totals = calculateOrderTotals({
    subtotal: cart.subtotal,
    discount: coupon?.discount ?? 0,
    itemCount: cart.lines.length,
  });

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const finish = async (orderId: string) => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.cart });
    await queryClient.invalidateQueries({ queryKey: ['orders'] });
    void navigate(`/order-success/${orderId}`, { replace: true });
  };

  const placeOrder = async () => {
    if (selectedAddress === undefined) {
      goTo(0);
      return;
    }
    setProcessing(true);
    try {
      const result = await checkoutApi.placeOrder(
        {
          shippingAddressId: selectedAddress.id,
          billingAddressId: null,
          paymentMethod: method,
          couponCode: coupon?.code ?? null,
        },
        attemptKey,
      );
      const { order, payment } = result;
      setPlaced(true);

      if (payment === null) {
        toast('Order placed - complete payment from your order page.');
        await queryClient.invalidateQueries({ queryKey: queryKeys.cart });
        void navigate(`/orders/${order.id}`, { replace: true });
        return;
      }
      if (payment.provider === 'COD') {
        await finish(order.id);
        return;
      }

      const success = await payWithRazorpay(payment);
      if (success === null) {
        toast('Payment not completed. You can retry from your order.');
        await queryClient.invalidateQueries({ queryKey: queryKeys.cart });
        void navigate(`/orders/${order.id}`, { replace: true });
        return;
      }
      await checkoutApi.verifyPayment({ orderId: order.id, ...success });
      await finish(order.id);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CART_INVALID') {
        toast.error('Some items changed. Please review your bag.');
        await queryClient.invalidateQueries({ queryKey: queryKeys.cart });
        void navigate('/cart');
        return;
      }
      toast.error(errorMessage(error));
    } finally {
      setProcessing(false);
    }
  };

  if (!cart.isLoading && cart.lines.length === 0 && !processing && !placed) {
    return <Navigate to="/cart" replace />;
  }

  return (
    <div className="container-page py-12">
      <Link
        to="/cart"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" /> Back to bag
      </Link>
      <h1 className="text-display mb-10 text-[clamp(2.8rem,6vw,4.6rem)]">Checkout</h1>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_420px]">
        <div>
          <Stepper step={step} onStep={goTo} />
          <AnimatePresence mode="wait" custom={direction}>
            {step === 0 && (
              <StepPanel key="address" direction={direction}>
                <div className="space-y-5">
                  <h2 className="text-display text-3xl">Where should we deliver?</h2>
                  {addresses.isPending ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Skeleton className="h-40" />
                      <Skeleton className="h-40" />
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {addresses.data?.map((address) => (
                          <AddressCard
                            key={address.id}
                            address={address}
                            selected={selectedAddress?.id === address.id}
                            onSelect={() => {
                              setAddressId(address.id);
                            }}
                          />
                        ))}
                        {!addingAddress && (
                          <button
                            type="button"
                            onClick={() => {
                              setAddingAddress(true);
                            }}
                            className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-border text-sm font-medium text-muted transition hover:border-accent hover:text-accent"
                          >
                            <Plus className="size-5" /> Add a new address
                          </button>
                        )}
                      </div>
                      <AnimatePresence>
                        {(addingAddress || addresses.data?.length === 0) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="rounded-3xl border border-border bg-surface p-6">
                              <AddressForm
                                onSaved={(address) => {
                                  setAddressId(address.id);
                                  setAddingAddress(false);
                                }}
                                {...(addresses.data?.length === 0
                                  ? {}
                                  : {
                                      onCancel: () => {
                                        setAddingAddress(false);
                                      },
                                    })}
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                  <div className="flex justify-end">
                    <Button
                      size="lg"
                      disabled={selectedAddress === undefined}
                      onClick={() => {
                        goTo(1);
                      }}
                    >
                      Continue to payment <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </StepPanel>
            )}

            {step === 1 && (
              <StepPanel key="payment" direction={direction}>
                <div className="space-y-5">
                  <h2 className="text-display text-3xl">How would you like to pay?</h2>
                  <div className="grid gap-4">
                    {(methods.data?.methods ?? []).map((option) => {
                      const Icon = option.id === 'COD' ? Banknote : CreditCard;
                      const active = method === option.id;
                      return (
                        <motion.button
                          key={option.id}
                          type="button"
                          whileTap={{ scale: 0.98 }}
                          disabled={!option.enabled}
                          onClick={() => {
                            setMethod(option.id);
                          }}
                          aria-pressed={active}
                          className={cn(
                            'relative flex items-center gap-4 overflow-hidden rounded-3xl border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-50',
                            active ? 'border-accent' : 'border-border hover:border-fg/30',
                          )}
                        >
                          {active && (
                            <motion.span
                              layoutId="payment-active"
                              className="absolute inset-0 bg-accent-soft/60 ring-4 ring-ring"
                              transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                            />
                          )}
                          <span className="relative grid size-12 place-items-center rounded-2xl bg-surface text-accent shadow-sm">
                            <Icon className="size-5" />
                          </span>
                          <span className="relative flex-1">
                            <span className="block font-semibold">{option.label}</span>
                            <span className="text-sm text-muted">
                              {option.id === 'COD'
                                ? 'Pay in cash or UPI when your order arrives.'
                                : option.enabled
                                  ? 'Pay securely with UPI, cards, wallets or netbanking.'
                                  : 'Not configured on this store yet.'}
                            </span>
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                  <div className="flex justify-between">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        goTo(0);
                      }}
                    >
                      <ArrowLeft className="size-4" /> Back
                    </Button>
                    <Button
                      size="lg"
                      onClick={() => {
                        goTo(2);
                      }}
                    >
                      Review order <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </StepPanel>
            )}

            {step === 2 && (
              <StepPanel key="review" direction={direction}>
                <div className="space-y-6">
                  <h2 className="text-display text-3xl">Review & place order</h2>
                  {selectedAddress !== undefined && (
                    <div className="flex items-start justify-between gap-4 rounded-3xl border border-border bg-surface p-5 text-sm">
                      <div>
                        <p className="eyebrow mb-2">Delivering to</p>
                        <p className="font-medium">
                          {selectedAddress.firstName} {selectedAddress.lastName}
                        </p>
                        <p className="text-muted">
                          {selectedAddress.addressLine1}, {selectedAddress.city},{' '}
                          {selectedAddress.state} {selectedAddress.postalCode}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          goTo(0);
                        }}
                        className="text-sm font-medium text-accent"
                      >
                        Change
                      </button>
                    </div>
                  )}
                  <ul className="divide-y divide-border rounded-3xl border border-border bg-surface">
                    {cart.lines.map((line) => (
                      <li key={line.id} className="flex items-center gap-4 p-4">
                        <span className="size-16 shrink-0 overflow-hidden rounded-2xl bg-surface-2">
                          {line.image !== null && (
                            <img
                              src={line.image}
                              alt=""
                              className="size-full object-contain p-1.5"
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{line.name}</span>
                          <span className="text-xs text-muted">
                            {formatAttributes(line.attributes)}{' '}
                            {line.attributes === null ? '' : '·'} Qty {line.quantity}
                          </span>
                        </span>
                        <span className="text-sm font-semibold">{formatMoney(line.lineTotal)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        goTo(1);
                      }}
                    >
                      <ArrowLeft className="size-4" /> Back
                    </Button>
                  </div>
                </div>
              </StepPanel>
            )}
          </AnimatePresence>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-5 rounded-[28px] border border-border bg-surface p-7 card-shadow">
            <h2 className="text-display text-3xl">Order summary</h2>
            <CouponBox
              applied={coupon}
              onApply={setCoupon}
              onRemove={() => {
                setCoupon(null);
              }}
            />
            <dl className="space-y-3 border-t border-border pt-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal · {pluralize(cart.itemCount, 'item')}</dt>
                <dd className="font-medium">
                  <AnimatedNumber value={totals.subtotal} />
                </dd>
              </div>
              <AnimatePresence>
                {totals.discount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex justify-between text-success"
                  >
                    <dt>Discount</dt>
                    <dd className="font-medium">
                      −<AnimatedNumber value={totals.discount} />
                    </dd>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex justify-between">
                <dt className="text-muted">Shipping</dt>
                <dd className="font-medium">
                  {totals.shipping === 0 ? 'Free' : formatMoney(totals.shipping)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">GST (18%)</dt>
                <dd className="font-medium">
                  <AnimatedNumber value={totals.tax} />
                </dd>
              </div>
              <div className="flex items-end justify-between border-t border-border pt-4">
                <dt className="font-medium">Total</dt>
                <dd className="text-3xl font-semibold">
                  <AnimatedNumber value={totals.total} />
                </dd>
              </div>
            </dl>
            <Button
              size="lg"
              variant="accent"
              className="w-full"
              disabled={step !== 2 || selectedAddress === undefined}
              loading={processing}
              onClick={() => {
                void placeOrder();
              }}
            >
              <Lock className="size-4" />
              {method === 'COD' ? 'Place order' : `Pay ${formatMoney(totals.total)}`}
            </Button>
            <p className="text-center text-xs text-muted">
              {step === 2
                ? 'Totals are confirmed securely on our servers.'
                : 'Complete the steps to place your order.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
