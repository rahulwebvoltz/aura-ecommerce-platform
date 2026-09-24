import type { DatabaseClient } from '@ecommerce/db';

import type { RazorpayGateway } from '../../../services/razorpay.js';
import { serviceUnavailable } from '../../../utils/errors.js';
import type { PaymentProvider } from './payment-provider.js';

/** Razorpay Standard Checkout. The provider order is created once and reused on retries. */
export function createRazorpayProvider(
  prisma: DatabaseClient,
  gateway: RazorpayGateway | null,
): PaymentProvider {
  function requireGateway(): RazorpayGateway {
    if (gateway === null) {
      throw serviceUnavailable('PAYMENT_METHOD_UNAVAILABLE', 'Online payments are not available.');
    }

    return gateway;
  }

  return {
    method: 'RAZORPAY',
    label: 'Cards, UPI & Netbanking (Razorpay)',
    isEnabled: () => gateway !== null,

    async initiate(order, payment) {
      const razorpay = requireGateway();
      let providerOrderId = payment.providerOrderId;
      if (providerOrderId === null) {
        const created = await razorpay.createOrder({
          amount: payment.amount,
          currency: payment.currency,
          receipt: order.orderNumber,
          notes: { orderId: order.id },
        });
        providerOrderId = created.id;
        await prisma.payment.update({ where: { id: payment.id }, data: { providerOrderId } });
      }

      return {
        provider: 'RAZORPAY',
        keyId: razorpay.keyId,
        providerOrderId,
        orderNumber: order.orderNumber,
        amount: payment.amount,
        currency: payment.currency,
        prefill: {
          name: order.customer.name,
          email: order.customer.email,
          contact: order.customer.phone,
        },
      };
    },

    async refund(payment) {
      if (payment.providerPaymentId === null) {
        return;
      }

      await requireGateway().refundPayment(payment.providerPaymentId, payment.amount);
    },
  };
}
