import type { Payment, PaymentMethod } from '@ecommerce/db';
import type { PaymentInitDto } from '@ecommerce/types';

export interface PaymentOrder {
  id: string;
  orderNumber: string;
  total: number;
  currency: string;
  customer: { name: string; email: string; phone: string };
}

/** A payment method. New providers implement this and register in the payment service. */
export interface PaymentProvider {
  readonly method: PaymentMethod;
  readonly label: string;
  isEnabled(): boolean;
  /** Prepares client-side payment details for a pending payment. */
  initiate(order: PaymentOrder, payment: Payment): Promise<PaymentInitDto>;
  /** Returns captured money to the customer. */
  refund(payment: Payment): Promise<void>;
}
